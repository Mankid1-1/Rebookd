# 🧪 Stripe Integration Testing Guide

Complete testing guide for the Stripe Checkout, webhooks, and customer portal integration.

## 📋 Overview

This guide covers testing scenarios for:
- **Stripe Checkout** with dual pricing (fixed + metered)
- **Webhook Processing** for subscription lifecycle
- **Customer Portal** for self-service management
- **Referral System** integration
- **Payment Processing** and error handling

## 🎯 Test Environment Setup

### 1. Stripe Test Mode

```bash
# Ensure you're using test keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 2. Test Cards

| Card Number | Purpose | Result |
|-------------|---------|--------|
| `4242 4242 4242 4242` | Successful payment | ✅ Success |
| `4000 0000 0000 0002` | Card declined | ❌ Declined |
| `4000 0000 0000 9995` | Insufficient funds | ❌ Declined |
| `4000 0000 0000 9987` | Lost card | ❌ Declined |
| `4000 0000 0000 9979` | Stolen card | ❌ Declined |
| `4000 0000 0000 0006` | Expired card | ❌ Declined |
| `4000 0000 0000 0044` | Processing error | ⏳ Pending |

### 3. Test Environment Variables

```bash
# Local development
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001

# Stripe configuration
STRIPE_WEBHOOK_SECRET=whsec_test_...
STRIPE_FIXED_PRICE_ID=price_FIXED_199
STRIPE_METERED_PRICE_ID=price_METERED_15
```

## 🔄 Testing Scenarios

### Scenario 1: Successful Checkout Flow

#### **Step 1: Generate Referral Code**

```bash
curl -X POST http://localhost:3001/api/referral/generateReferralCode \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "referralCode": "ABC12345",
  "message": "Referral code generated successfully",
  "expiresAt": "2024-06-22T12:00:00.000Z"
}
```

#### **Step 2: Create Checkout Session**

```bash
curl -X POST http://localhost:3001/api/stripe-checkout/createCheckoutSession \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "customerEmail": "test@example.com",
    "referralCode": "ABC12345"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_test_...",
  "message": "Checkout session created successfully"
}
```

#### **Step 3: Complete Checkout**

1. Redirect to `checkoutUrl`
2. Use test card `4242 4242 4242 4242`
3. Complete payment form
4. Redirect to success page

#### **Step 4: Verify Webhook Processing**

```bash
# Check webhook event logs
curl http://localhost:3001/api/webhook-events

# Verify subscription creation
curl http://localhost:3001/api/subscriptions
```

### Scenario 2: Referral Processing

#### **Step 1: Process Referral During Signup**

```bash
curl -X POST http://localhost:3001/api/referral/processReferral \
  -H "Content-Type: application/json" \
  -d '{
    "referralCode": "ABC12345",
    "referredUserId": "user123"
  }'
```

#### **Step 2: Complete Referral After 6 Months**

```bash
curl -X POST http://localhost:3001/api/referral/completeReferral \
  -H "Content-Type: application/json" \
  -d '{
    "referralId": "ref_123",
    "subscriptionId": "sub_123",
    "subscriptionMonths": 6
  }'
```

#### **Step 3: Verify Referral Reward**

```bash
curl -X GET http://localhost:3001/api/referral/getReferralStats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Scenario 3: Payment Failure Handling

#### **Step 1: Create Checkout with Declined Card**

1. Start checkout process
2. Use card `4000 0000 0000 0002` (declined)
3. Verify error handling

#### **Step 2: Test Invoice Payment Failed Webhook**

```bash
# Simulate failed payment webhook
curl -X POST http://localhost:3001/api/stripe-webhooks/processWebhookEvent \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: webhook_signature" \
  -d '{
    "body": "webhook_payload",
    "signature": "stripe_signature",
    "endpointSecret": "webhook_secret"
  }'
```

#### **Step 3: Verify Email Notifications**

Check that:
- ❌ Payment failure email sent
- 📧 Retry notification sent
- 🔄 Subscription status updated to `past_due`

### Scenario 4: Customer Portal Testing

#### **Step 1: Create Portal Session**

```bash
curl -X POST http://localhost:3001/api/customer-portal/createPortalSession \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "customerId": "cus_123",
    "returnUrl": "http://localhost:3000/billing"
  }'
```

#### **Step 2: Test Portal Features**

1. **Update Payment Method**
   - Add new card
   - Set as default
   - Remove old card

2. **View Billing History**
   - Download invoices
   - Check payment status

3. **Manage Subscription**
   - Upgrade/downgrade plan
   - Cancel subscription
   - Reactivate canceled subscription

#### **Step 3: Verify Portal Changes**

```bash
# Check updated subscription details
curl -X POST http://localhost:3001/api/customer-portal/getSubscriptionDetails \
  -H "Content-Type: application/json" \
  -d '{"customerId": "cus_123"}'
```

### Scenario 5: Metered Billing Testing

#### **Step 1: Report Usage**

```bash
curl -X POST http://localhost:3001/api/stripe-checkout/reportUsage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "customerId": "cus_123",
    "recoveredAmount": 1250
  }'
```

#### **Step 2: Check Current Usage**

```bash
curl -X POST http://localhost:3001/api/stripe-checkout/getCurrentUsage \
  -H "Content-Type: application/json" \
  -d '{"customerId": "cus_123"}'
```

#### **Step 3: Verify Upcoming Invoice**

```bash
curl -X POST http://localhost:3001/api/customer-portal/getUpcomingInvoice \
  -H "Content-Type: application/json" \
  -d '{"customerId": "cus_123"}'
```

## 🧪 Automated Testing

### Unit Tests

```typescript
// tests/stripe-checkout.test.ts
describe('Stripe Checkout Service', () => {
  test('should create checkout session with referral', async () => {
    const result = await createCheckoutSession({
      customerEmail: 'test@example.com',
      userId: 'user123',
      tenantId: 'tenant123',
      referralCode: 'ABC12345',
    });
    
    expect(result).toContain('checkout.stripe.com');
  });

  test('should process successful checkout', async () => {
    const session = mockStripeSession();
    const result = await processSuccessfulCheckout(session.id);
    
    expect(result.status).toBe('active');
    expect(result.customerId).toBe('cus_123');
  });
});

// tests/referral-system.test.ts
describe('Referral System', () => {
  test('should generate unique referral code', async () => {
    const code = await generateReferralCode('user123');
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  test('should complete referral after 6 months', async () => {
    const referral = await completeReferral('ref123', 'sub123', 6);
    expect(referral.status).toBe('completed');
    expect(referral.rewardAmount).toBe(50);
  });
});
```

### Integration Tests

```typescript
// tests/integration/subscription-lifecycle.test.ts
describe('Subscription Lifecycle', () => {
  test('complete subscription flow', async () => {
    // 1. Create checkout session
    const session = await createCheckoutSession({
      customerEmail: 'test@example.com',
    });

    // 2. Complete payment
    await completePayment(session.id);

    // 3. Verify subscription created
    const subscription = await getSubscription(session.subscriptionId);
    expect(subscription.status).toBe('active');

    // 4. Report usage
    await reportUsage(subscription.customerId, 1000);

    // 5. Verify usage recorded
    const usage = await getCurrentUsage(subscription.customerId);
    expect(usage.totalUsage).toBe(1000);

    // 6. Cancel subscription
    await cancelSubscription(subscription.id);

    // 7. Verify cancellation
    const canceledSub = await getSubscription(subscription.id);
    expect(canceledSub.cancelAtPeriodEnd).toBe(true);
  });
});
```

### E2E Tests

```typescript
// tests/e2e/customer-journey.test.ts
describe('Customer Journey', () => {
  test('new customer with referral', async () => {
    // 1. Get referral code
    const referrer = await createTestUser();
    const referralCode = await generateReferralCode(referrer.id);

    // 2. New user signs up with referral
    const newUser = await createTestUser();
    await processReferral(referralCode, newUser.id);

    // 3. New user subscribes
    const subscription = await createSubscription(newUser.email);

    // 4. Verify referral completed
    const referrerStats = await getReferralStats(referrer.id);
    expect(referrerStats.completedReferrals).toBe(1);
    expect(referrerStats.totalEarned).toBe(50);

    // 5. Referrer requests payout
    const payout = await requestPayout(referrer.id, 'paypal');
    expect(payout.amount).toBe(50);
  });
});
```

## 🔧 Testing Tools

### 1. Stripe CLI

```bash
# Install Stripe CLI
npm install -g stripe-cli

# Login to Stripe
stripe login

# Listen for webhooks locally
stripe listen --forward-to localhost:3001/api/stripe-webhooks/processWebhookEvent

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

### 2. Postman Collection

Create a Postman collection with these endpoints:

```json
{
  "info": {
    "name": "Rebooked Stripe API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create Checkout Session",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{jwt_token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"customerEmail\": \"test@example.com\",\n  \"referralCode\": \"ABC12345\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/stripe-checkout/createCheckoutSession"
        }
      }
    }
  ]
}
```

### 3. Test Scripts

```bash
#!/bin/bash
# test-stripe-integration.sh

echo "🧪 Testing Stripe Integration..."

# Test 1: Create checkout session
echo "Test 1: Creating checkout session..."
response=$(curl -s -X POST http://localhost:3001/api/stripe-checkout/createCheckoutSession \
  -H "Content-Type: application/json" \
  -d '{"customerEmail": "test@example.com"}')

if [[ $response == *"checkout.stripe.com"* ]]; then
  echo "✅ Checkout session created successfully"
else
  echo "❌ Checkout session creation failed"
  echo $response
fi

# Test 2: Process webhook
echo "Test 2: Processing webhook..."
webhook_response=$(curl -s -X POST http://localhost:3001/api/stripe-webhooks/processWebhookEvent \
  -H "Content-Type: application/json" \
  -d '{"body": "test", "signature": "test", "endpointSecret": "test"}')

if [[ $webhook_response == *"processed"* ]]; then
  echo "✅ Webhook processed successfully"
else
  echo "❌ Webhook processing failed"
fi

echo "🎉 Stripe integration testing completed!"
```

## 📊 Monitoring & Analytics

### 1. Test Metrics Dashboard

Track these metrics during testing:

- **Checkout Success Rate**: % of completed checkouts
- **Payment Success Rate**: % of successful payments
- **Webhook Processing Time**: Average processing time
- **Referral Conversion Rate**: % of referrals that convert
- **Customer Portal Usage**: Portal session metrics

### 2. Error Tracking

Monitor for these errors:

- **Checkout Failures**: Payment declines, validation errors
- **Webhook Failures**: Processing errors, timeouts
- **Referral Issues**: Invalid codes, duplicate processing
- **Portal Errors**: Session creation failures

### 3. Performance Testing

```typescript
// tests/performance/checkout-performance.test.ts
describe('Checkout Performance', () => {
  test('checkout session creation under 2 seconds', async () => {
    const start = Date.now();
    await createCheckoutSession(testData);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(2000);
  });

  test('webhook processing under 1 second', async () => {
    const start = Date.now();
    await processStripeWebhook(mockWebhookEvent);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(1000);
  });
});
```

## 🚀 Go-Live Checklist

### Pre-Launch Testing

- [ ] All test scenarios pass
- [ ] Webhook endpoints accessible from Stripe
- [ ] Customer portal functions correctly
- [ ] Referral system works end-to-end
- [ ] Error handling covers all edge cases
- [ ] Performance meets requirements
- [ ] Security measures in place

### Production Readiness

- [ ] Live Stripe keys configured
- [ ] Webhook secrets updated
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Monitoring enabled
- [ ] Error reporting configured
- [ ] Backup procedures tested

### Post-Launch Monitoring

- [ ] Real transaction monitoring
- [ ] Webhook delivery tracking
- [ ] Customer feedback collection
- [ ] Performance metrics review
- [ ] Error rate monitoring

---

**This testing guide ensures a robust, reliable Stripe integration that handles all edge cases and provides excellent user experience.** 🎯
