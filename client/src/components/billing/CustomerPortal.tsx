/**
 * 🎯 CUSTOMER PORTAL COMPONENT
 * Complete self-service subscription management interface
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/lib/trpc';
import { 
  CreditCard, 
  Download, 
  ExternalLink, 
  Calendar, 
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Settings,
  User,
  Mail
} from 'lucide-react';

interface SubscriptionDetails {
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    items: Array<{
      id: string;
      priceId: string;
      nickname: string;
      amount: number;
      currency: string;
      recurring: any;
      usageType: string;
      quantity: number;
    }>;
  };
  upcomingInvoice?: {
    amount: number;
    currency: string;
    dueDate: Date | null;
    lineItems: Array<{
      description: string;
      amount: number;
      quantity: number;
    }>;
  };
  paymentMethods: Array<{
    id: string;
    type: string;
    card: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    } | null;
    isDefault: boolean;
  }>;
  billingHistory: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: Date;
    hostedInvoiceUrl: string;
    invoicePdf: string;
  }>;
  currentUsage: {
    totalUsage: number;
    items: Array<{
      subscriptionItemId: string;
      priceId: string;
      nickname: string;
      unitAmount: number;
      totalUsage: number;
      estimatedCharge: number;
    }>;
  };
}

interface CustomerPortalProps {
  customerId: string;
  onSubscriptionChange?: (details: SubscriptionDetails) => void;
}

export function CustomerPortal({ customerId, onSubscriptionChange }: CustomerPortalProps) {
  const [loading, setLoading] = useState(true);
  const [portalUrl, setPortalUrl] = useState<string>('');
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [error, setError] = useState<string>('');

  // Get dynamic plan data
  const { data: plans = [] } = trpc.plans.list.useQuery();
  
  // Find the main plan with revenue share
  const mainPlan = plans.find(p => p.revenueSharePercent && p.revenueSharePercent > 0) || plans[0];
  const revenueSharePercent = mainPlan?.revenueSharePercent || 15;

  useEffect(() => {
    loadSubscriptionDetails();
  }, [customerId]);

  const loadSubscriptionDetails = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/customer-portal/getSubscriptionDetails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });

      const data = await response.json();

      if (data.success) {
        setSubscriptionDetails(data.details);
        onSubscriptionChange?.(data.details);
      } else {
        setError(data.message || 'Failed to load subscription details');
      }
    } catch (err) {
      setError('An error occurred while loading subscription details');
      console.error('Portal error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    try {
      const response = await fetch('/api/customer-portal/createPortalSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customerId,
          returnUrl: window.location.href
        }),
      });

      const data = await response.json();

      if (data.success) {
        window.location.href = data.portalUrl;
      } else {
        setError(data.message || 'Failed to create portal session');
      }
    } catch (err) {
      setError('Failed to open customer portal');
      console.error('Portal error:', err);
    }
  };

  const downloadInvoice = async (invoiceId: string) => {
    try {
      const response = await fetch('/api/customer-portal/downloadInvoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });

      const data = await response.json();

      if (data.success) {
        window.open(data.pdfUrl, '_blank');
      } else {
        setError('Failed to download invoice');
      }
    } catch (err) {
      setError('Failed to download invoice');
      console.error('Invoice download error:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      past_due: 'destructive',
      canceled: 'secondary',
      incomplete: 'outline',
      incomplete_expired: 'outline',
      trialing: 'secondary',
      unpaid: 'destructive',
    };
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!subscriptionDetails) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No active subscription found. {error && `Error: ${error}`}
        </AlertDescription>
      </Alert>
    );
  }

  const { subscription, upcomingInvoice, paymentMethods, billingHistory, currentUsage } = subscriptionDetails;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Subscription Management</h2>
          <p className="text-gray-600">Manage your billing and subscription preferences</p>
        </div>
        <Button onClick={openCustomerPortal} className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Manage in Stripe Portal
        </Button>
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

      {/* Subscription Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Current Subscription
          </CardTitle>
          <CardDescription>
            Your active subscription details and billing information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status and Period */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {getStatusBadge(subscription.status)}
                {subscription.cancelAtPeriodEnd && (
                  <Badge variant="outline">Cancels at period end</Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">
                Current period: {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                ${subscription.items.reduce((sum, item) => sum + (item.amount / 100), 0)}
              </div>
              <p className="text-sm text-gray-500">per month</p>
            </div>
          </div>

          {/* Subscription Items */}
          <div className="space-y-3">
            <h4 className="font-semibold">Subscription Items</h4>
            {subscription.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{item.nickname}</p>
                  <p className="text-sm text-gray-500">
                    {item.usageType === 'metered' ? 'Usage-based billing' : 'Fixed amount'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {item.usageType === 'metered' ? `${revenueSharePercent}% of recovered revenue` : `$${item.amount / 100}`}
                  </p>
                  {item.quantity > 1 && (
                    <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Current Usage */}
          {currentUsage.totalUsage > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold">Current Usage</h4>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-800">Revenue Recovered This Period</span>
                  <span className="text-2xl font-bold text-blue-800">
                    ${currentUsage.totalUsage.toFixed(2)}
                  </span>
                </div>
                <div className="text-sm text-blue-600">
                  Estimated charge: ${currentUsage.items.reduce((sum, item) => sum + item.estimatedCharge, 0).toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Invoice */}
          {upcomingInvoice && (
            <div className="space-y-3">
              <h4 className="font-semibold">Upcoming Invoice</h4>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700">Amount Due</span>
                  <span className="text-xl font-bold">
                    ${upcomingInvoice.amount.toFixed(2)}
                  </span>
                </div>
                {upcomingInvoice.dueDate && (
                  <p className="text-sm text-gray-600">
                    Due: {formatDate(upcomingInvoice.dueDate)}
                  </p>
                )}
                <div className="mt-3 space-y-1">
                  {upcomingInvoice.lineItems.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{item.description}</span>
                      <span>${(item.amount * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs defaultValue="payment-methods" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="billing-history">Billing History</TabsTrigger>
          <TabsTrigger value="usage">Usage Details</TabsTrigger>
        </TabsList>

        <TabsContent value="payment-methods">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Manage your payment methods and billing information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paymentMethods.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No payment methods on file
                  </p>
                ) : (
                  paymentMethods.map((method) => (
                    <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <CreditCard className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium">
                            {method.card?.brand.toUpperCase()} •••• {method.card?.last4}
                          </p>
                          <p className="text-sm text-gray-500">
                            Expires {method.card?.expMonth}/{method.card?.expYear}
                          </p>
                        </div>
                      </div>
                      {method.isDefault && (
                        <Badge variant="outline">Default</Badge>
                      )}
                    </div>
                  ))
                )}
                <div className="pt-4">
                  <Button variant="outline" onClick={openCustomerPortal}>
                    Manage Payment Methods
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing-history">
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>
                View your past invoices and payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {billingHistory.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No billing history available
                  </p>
                ) : (
                  billingHistory.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium">
                            {formatDate(invoice.createdAt)}
                          </p>
                          <p className="text-sm text-gray-500">
                            Invoice #{invoice.id.slice(-8)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium">
                            ${(invoice.amount / 100).toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {invoice.status.toUpperCase()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadInvoice(invoice.id)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Usage Details</CardTitle>
              <CardDescription>
                Detailed breakdown of your usage-based billing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentUsage.items.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No usage-based billing active
                  </p>
                ) : (
                  currentUsage.items.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold">{item.nickname}</h4>
                        <div className="text-right">
                          <p className="font-medium">
                            ${item.estimatedCharge.toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-500">
                            Current charge
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Total Usage</p>
                          <p className="font-medium">${item.totalUsage.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Rate</p>
                          <p className="font-medium">{(item.unitAmount / 100).toFixed(2)}%</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common subscription management tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" onClick={openCustomerPortal} className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Update Payment Method
            </Button>
            <Button variant="outline" onClick={openCustomerPortal} className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              View Upcoming Bills
            </Button>
            <Button variant="outline" onClick={openCustomerPortal} className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Download Invoices
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
