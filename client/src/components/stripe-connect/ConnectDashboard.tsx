/**
 * 🚀 STRIPE CONNECT DASHBOARD
 * Main dashboard for Stripe Connect account management
 * Based on Stripe sample code with Rebooked integration
 */

import React from 'react';
import { safeStripeRedirect } from '@/utils/safeRedirect';
import { useStripeConnect } from './StripeConnectProvider';
import ConnectOnboarding from './ConnectOnboarding';
import ConnectProducts from './ConnectProducts';

const ConnectDashboard: React.FC = () => {
  const { accountId, needsOnboarding, accountStatus } = useStripeConnect();

  const handleSubscribeToPlatform = async () => {
    if (!accountId) return;

    try {
      const response = await fetch('/api/stripe-connect/subscribeToPlatform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message);
      }

      const data = await response.json();
      safeStripeRedirect(data.result.url);
      
    } catch (error: any) {
      console.error('Platform subscription error:', error);
      alert('Failed to subscribe to platform: ' + error.message);
    }
  };

  if (!accountId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Stripe Connect Platform
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Connect your Stripe account to start accepting payments through Rebooked
          </p>
          
          <div className="bg-white rounded-lg shadow-md p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-6">Get Started</h2>
            <p className="text-muted-foreground mb-6">
              Create your Stripe Connect account to enable payment processing, 
              subscription management, and automated billing for your customers.
            </p>
            
            <ConnectOnboarding />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md mb-6 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Stripe Connect Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your Stripe Connect account and products
            </p>
          </div>
          
          {accountStatus?.charges_enabled && accountStatus?.payouts_enabled && (
            <button
              onClick={handleSubscribeToPlatform}
              className="bg-success text-white px-6 py-3 rounded-lg hover:bg-success/90"
            >
              Subscribe to Platform
            </button>
          )}
        </div>

        {/* Account Status Overview */}
        {accountStatus && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-info/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">Account ID</h3>
              <p className="text-info font-mono text-sm">{accountStatus.id}</p>
            </div>

            <div className="bg-success/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">Charges</h3>
              <p className={`text-2xl font-bold ${accountStatus.charges_enabled ? 'text-success' : 'text-destructive'}`}>
                {accountStatus.charges_enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>

            <div className="bg-accent/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">Payouts</h3>
              <p className={`text-2xl font-bold ${accountStatus.payouts_enabled ? 'text-success' : 'text-destructive'}`}>
                {accountStatus.payouts_enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>

            <div className="bg-warning/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">Status</h3>
              <p className={`text-xl font-bold ${accountStatus.details_submitted ? 'text-success' : 'text-warning'}`}>
                {accountStatus.details_submitted ? 'Active' : 'Pending'}
              </p>
            </div>
          </div>
        )}

        {/* Onboarding Required */}
        {needsOnboarding && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 mb-8">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 2.502-3.291C21.962 10.335 21.962 7.5c0-2.835-1.667-4.291-4.291-4.291H4.291C2.667 3.209 1 4.765 1 7.5s1.667 4.291 4.291 4.291h15.416c.54 0 1.046-.201 1.511-.5m-5.416 0H4.291m5.416 0v5.416m-5.416 0h5.416" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-warning">
                  Complete Stripe Onboarding
                </h3>
                <p className="text-warning mt-1">
                  You need to complete your Stripe Connect account setup before you can access all features.
                </p>
              </div>
            </div>
            
            <ConnectOnboarding />
          </div>
        )}

        {/* Products Management */}
        {!needsOnboarding && <ConnectProducts />}

        {/* Platform Benefits */}
        <div className="mt-8 bg-gradient-to-r from-info/5 to-accent/5 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
            Platform Benefits
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="w-12 h-12 bg-info rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3s3 1.343 3 3 3 3-1.343 3-3 3m0-6c1.657 0 3-1.343 3-3s-3 1.343-3 3-3 3 1.343 3 3 3m0-6c-1.657 0-3 1.343-3 3-3s-3-1.343-3-3-3-3-1.343-3-3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Easy Integration</h3>
                <p className="text-muted-foreground text-sm">
                  Seamless Stripe Connect integration with your existing systems
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2l2-2m-6 2l-4 4m0 0l2-2m-6 2l-2 2m0 0l2-2" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Automated Payouts</h3>
                <p className="text-muted-foreground text-sm">
                  Automatic payouts to your bank account with detailed reporting
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7m0 4h4m-6 0h.01M9 21h6m-6 0h.01" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Full Support</h3>
                <p className="text-muted-foreground text-sm">
                  24/7 technical support and comprehensive documentation
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectDashboard;
