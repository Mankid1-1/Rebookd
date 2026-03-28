# 🎯 Referral System Implementation

A comprehensive referral system with **$50 per 6-month subscription** incentive, integrated with Stripe Checkout and metered billing.

## 📋 Overview

The referral system incentivizes users to refer companies to Rebooked by offering **$50 for every successful referral** (company subscribes for 6+ months). The system includes:

- **Referral Code Generation**: Unique 8-character codes
- **Referral Tracking**: Real-time status monitoring
- **Automated Payouts**: PayPal, Stripe, or bank transfer
- **Leaderboard**: Gamification with rankings
- **Stripe Integration**: Seamless checkout with metered billing

## 🏗️ Architecture

### Backend Components

#### 1. Database Schema
```sql
-- Referrals table
CREATE TABLE referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referrer_id INT NOT NULL,
  referred_user_id INT NOT NULL,
  referral_code VARCHAR(16) NOT NULL UNIQUE,
  status ENUM('pending', 'completed', 'expired', 'cancelled'),
  reward_amount INT DEFAULT 50,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  -- ... additional fields
);

-- Referral payouts table
CREATE TABLE referral_payouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount INT NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed'),
  method ENUM('paypal', 'stripe', 'bank_transfer'),
  -- ... additional fields
);
```

#### 2. Service Layer
- **`referral.service.ts`**: Core referral logic
- **`stripe-checkout.service.ts`**: Stripe integration
- **Database operations**: CRUD operations with Drizzle ORM

#### 3. API Routes
- **`/api/referral/*`**: Referral management endpoints
- **`/api/stripe-checkout/*`**: Stripe checkout endpoints
- **Webhook handlers**: Stripe event processing

### Frontend Components

#### 1. Referral Dashboard
- **`ReferralDashboard.tsx`**: Complete referral management UI
- **Statistics display**: Earnings, referrals, leaderboard
- **Payout management**: Request and track payouts

#### 2. Stripe Checkout
- **`StripeCheckout.tsx`**: Checkout form with pricing display
- **Referral code support**: Automatic application during signup
- **Metered billing explanation**: Clear pricing breakdown

## 💳 Stripe Integration

### Pricing Model

1. **Fixed Monthly Fee**: $199/month
   - Unlimited platform access
   - All automation features
   - Priority support

2. **Performance-Based Fee**: 15% of recovered revenue
   - Only pay for actual results
   - Real-time usage tracking
   - Automated billing

### Checkout Flow

```typescript
// 1. Create checkout session
const checkoutUrl = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [
    { price: 'price_FIXED_199', quantity: 1 },      // $199 fixed
    { price: 'price_METERED_15' },                  // 15% metered
  ],
  customer_email: 'user@example.com',
  success_url: 'https://app.rebooked.com/billing/success',
  cancel_url: 'https://app.rebooked.com/pricing',
});

// 2. Redirect to Stripe Checkout
window.location.href = checkoutUrl;

// 3. Process webhook on completion
await StripeCheckoutService.processSuccessfulCheckout(sessionId);
```

### Usage Reporting

```typescript
// Report revenue recovery to Stripe
await stripe.subscriptionItems.createUsageRecord(meteredItemId, {
  quantity: recoveredAmount, // $1,250 recovered
  action: 'increment',
});
```

## 🔧 Implementation Details

### Referral Code Generation

```typescript
export async function generateReferralCode(userId: string): Promise<string> {
  // Generate unique 8-character code
  const code = Math.random()
    .toString(36)
    .substring(2, 10)
    .toUpperCase();
  
  // Store in database with 90-day expiry
  await db.insert('referrals').values({
    referrerId: userId,
    referralCode: code,
    status: 'pending',
    rewardAmount: 50,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  });
  
  return code;
}
```

### Referral Completion

```typescript
export async function completeReferral(
  referralId: string,
  subscriptionId: string,
  subscriptionMonths: number
): Promise<Referral> {
  // Verify 6+ month requirement
  if (subscriptionMonths < 6) {
    throw new Error('Subscription must be at least 6 months');
  }
  
  // Update referral status
  const referral = await db.update('referrals')
    .set({ 
      status: 'completed',
      subscriptionId,
      completedAt: new Date()
    })
    .where('id', '=', referralId);
  
  // Create payout record
  await createPayoutRecord(referral.referrerId, 50);
  
  return referral;
}
```

### Payout Processing

```typescript
export async function requestPayout(
  userId: string,
  method: 'paypal' | 'stripe' | 'bank_transfer'
): Promise<ReferralPayout> {
  // Calculate available balance
  const stats = await getReferralStats(userId);
  
  if (stats.availableForPayout <= 0) {
    throw new Error('No available earnings for payout');
  }
  
  // Create payout request
  const payout = await db.insert('referral_payouts').values({
    userId,
    amount: stats.availableForPayout,
    method,
    status: 'pending',
  });
  
  return payout;
}
```

## 🚀 Deployment Setup

### 1. Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_FIXED_PRICE_ID=price_FIXED_199
STRIPE_METERED_PRICE_ID=price_METERED_15
STRIPE_WEBHOOK_SECRET=whsec_...

# Referral Settings
REFERRAL_REWARD_AMOUNT=50
REFERRAL_MINIMUM_MONTHS=6
REFERRAL_EXPIRY_DAYS=90

# Application URLs
FRONTEND_URL=https://app.rebooked.com
BACKEND_URL=https://api.rebooked.com
```

### 2. Database Migration

```bash
# Run the migration
mysql -u root -p rebooked < server/migrations/001_create_referral_tables.sql
```

### 3. Stripe Webhook Setup

```bash
# Create webhook endpoint
ngrok http 3000

# Add webhook in Stripe Dashboard
# Endpoint: https://your-domain.com/api/stripe-webhooks/processWebhookEvent
# Events: checkout.session.completed, invoice.payment_succeeded, etc.
```

## 📱 Frontend Integration

### Referral Dashboard Usage

```typescript
import { ReferralDashboard } from '@/components/referral/ReferralDashboard';

function BillingPage() {
  return (
    <div>
      <ReferralDashboard />
    </div>
  );
}
```

### Stripe Checkout Integration

```typescript
import { StripeCheckout } from '@/components/billing/StripeCheckout';

function PricingPage() {
  const [referralCode] = useState(new URLSearchParams(window.location.search).get('ref'));
  
  return (
    <StripeCheckout 
      referralCode={referralCode}
      onSuccess={(sessionId) => {
        // Handle successful checkout
        console.log('Checkout completed:', sessionId);
      }}
    />
  );
}
```

## 🔍 API Endpoints

### Referral Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/referral/generateReferralCode` | POST | Generate new referral code |
| `/api/referral/processReferral` | POST | Process referral during signup |
| `/api/referral/getReferralStats` | GET | Get user's referral statistics |
| `/api/referral/getUserReferrals` | GET | Get user's referral history |
| `/api/referral/requestPayout` | POST | Request payout of earnings |
| `/api/referral/getUserPayouts` | GET | Get payout history |
| `/api/referral/getLeaderboard` | GET | Get referral leaderboard |

### Stripe Checkout

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stripe-checkout/createCheckoutSession` | POST | Create Stripe checkout session |
| `/api/stripe-checkout/reportUsage` | POST | Report revenue recovery usage |
| `/api/stripe-checkout/getCurrentUsage` | GET | Get current billing period usage |
| `/api/stripe-checkout/createPortalSession` | POST | Create customer portal session |

## 📊 Analytics & Reporting

### Referral Metrics

- **Total Referrals**: Number of users referred
- **Conversion Rate**: Percentage that convert to paid subscriptions
- **Average Time to Conversion**: Time from referral to subscription
- **Revenue Impact**: Total revenue from referred customers
- **Payout History**: Track all referral payments

### Stripe Analytics

- **MRR (Monthly Recurring Revenue)**: Fixed + metered components
- **Usage Metrics**: Revenue recovered per customer
- **Churn Rate**: Subscription cancellations
- **Customer Lifetime Value**: Total revenue per customer

## 🔒 Security Considerations

1. **Referral Code Security**: 
   - 8-character random codes
   - 90-day expiration
   - Rate limiting on generation

2. **Stripe Security**:
   - Webhook signature verification
   - PCI compliance via Stripe Checkout
   - Secure API key management

3. **Payout Security**:
   - Manual review for large payouts
   - Anti-fraud measures
   - Secure payment method verification

## 🧪 Testing

### Unit Tests

```typescript
describe('Referral Service', () => {
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
describe('Stripe Checkout Integration', () => {
  test('should create checkout session with referral', async () => {
    const response = await createCheckoutSession({
      customerEmail: 'test@example.com',
      referralCode: 'ABC12345',
    });
    
    expect(response.success).toBe(true);
    expect(response.checkoutUrl).toContain('checkout.stripe.com');
  });
});
```

## 🚀 Performance Optimization

1. **Database Indexing**: Optimized queries for referral lookups
2. **Caching**: Redis cache for leaderboard and stats
3. **Background Jobs**: Payout processing and cleanup
4. **Rate Limiting**: Prevent abuse of referral system

## 📈 Scaling Considerations

1. **Horizontal Scaling**: Stateless API design
2. **Database Sharding**: Split by tenant for large scale
3. **Queue System**: Background processing for payouts
4. **Monitoring**: Track referral conversion rates and revenue

## 🔄 Future Enhancements

1. **Multi-tier Rewards**: Different rewards for different subscription tiers
2. **Gamification**: Badges, achievements, and progress tracking
3. **Referral Analytics**: Advanced reporting and insights
4. **Automated Marketing**: Email campaigns for referred users
5. **API Integration**: Third-party referral tracking

## 📞 Support

For questions or issues with the referral system:

1. **Documentation**: Check this README and code comments
2. **Logs**: Monitor application logs for errors
3. **Analytics**: Review referral metrics in dashboard
4. **Testing**: Use provided test suites for validation

---

**Built with ❤️ for the Rebooked team**
