/**
 * 💳 STRIPE CHECKOUT COMPONENT
 * Frontend integration for Stripe Checkout with metered billing
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Check, 
  AlertCircle, 
  ExternalLink,
  TrendingUp,
  DollarSign,
  Shield
} from 'lucide-react';

interface StripeCheckoutProps {
  onSuccess?: (sessionId: string) => void;
  onCancel?: () => void;
  referralCode?: string;
}

export function StripeCheckout({ onSuccess, onCancel, referralCode }: StripeCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState('');

  const handleCheckout = async () => {
    if (!customerEmail) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/stripe-checkout/createCheckoutSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerEmail,
          referralCode,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkoutUrl;
      } else {
        setError(data.message || 'Failed to create checkout session');
      }
    } catch (err) {
      setError('An error occurred while creating the checkout session');
      console.error('Checkout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Pricing Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Rebooked Subscription
          </CardTitle>
          <CardDescription>
            Complete booking automation with revenue recovery - pay only for results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pricing Tiers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fixed Price */}
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Platform Access</h3>
                <Badge variant="outline">Fixed</Badge>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold">$199</div>
                <div className="text-sm text-gray-500">per month</div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Unlimited leads & contacts
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  All automation features
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  SMS & email messaging
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Analytics & reporting
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Priority support
                </li>
              </ul>
            </div>

            {/* Metered Price */}
            <div className="border rounded-lg p-6 space-y-4 bg-gradient-to-br from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Revenue Recovery</h3>
                <Badge className="bg-blue-100 text-blue-800">Performance</Badge>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold">15%</div>
                <div className="text-sm text-gray-500">of recovered revenue</div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  AI-powered recovery
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Automated follow-ups
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Smart scheduling
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Real-time tracking
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  No upfront cost
                </li>
              </ul>
            </div>
          </div>

          {/* Referral Code */}
          {referralCode && (
            <Alert className="bg-green-50 border-green-200">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Referral Applied:</strong> You're using referral code <code className="bg-green-100 px-1 rounded">{referralCode}</code>
              </AlertDescription>
            </Alert>
          )}

          {/* Customer Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="max-w-md"
            />
          </div>

          {/* Error Display */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Checkout Button */}
          <div className="space-y-4">
            <Button
              onClick={handleCheckout}
              disabled={loading || !customerEmail}
              className="w-full md:w-auto"
              size="lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Checkout...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Subscribe to Rebooked - $199/mo + 15% recovered
                </>
              )}
            </Button>

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4" />
                Secure payment via Stripe
              </div>
              <div className="flex items-center gap-1">
                <ExternalLink className="w-4 h-4" />
                Cancel anytime
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            How Billing Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Fixed Monthly Fee</h4>
              <p className="text-sm text-gray-600">
                $199 per month for unlimited access to all platform features, 
                including automation, messaging, and analytics.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Performance-Based Fee</h4>
              <p className="text-sm text-gray-600">
                15% of revenue recovered through our AI-powered system. 
                Only pay for actual results - no recovery, no fee.
              </p>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Example Monthly Bill</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Platform Access (Fixed)</span>
                <span>$199.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Revenue Recovered: $2,500</span>
                <span>$375.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Revenue Recovered: $1,200</span>
                <span>$180.00</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total Monthly Bill</span>
                <span>$754.00</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
