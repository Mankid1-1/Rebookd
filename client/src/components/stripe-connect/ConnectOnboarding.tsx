/**
 * 🚀 STRIPE CONNECT ONBOARDING
 * Component for handling Stripe Connect account onboarding
 * Based on Stripe sample code with Rebooked integration
 */

import React, { useState } from 'react';
import { useStripeConnect } from './StripeConnectProvider';

interface ConnectOnboardingProps {
  onComplete?: (accountId: string) => void;
}

const ConnectOnboarding: React.FC<ConnectOnboardingProps> = ({ onComplete }) => {
  const { accountId, setAccountId } = useStripeConnect();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !displayName) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Create Connect account
      const response = await fetch('/api/stripe-connect/createConnectAccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message);
      }

      const data = await response.json();
      const newAccountId = data.result.account.id;
      
      // Create account link for onboarding
      const linkResponse = await fetch('/api/stripe-connect/createAccountLink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: newAccountId }),
      });

      if (!linkResponse.ok) {
        const linkErrorData = await linkResponse.json();
        throw new Error(linkErrorData.error.message);
      }

      const linkData = await linkResponse.json();
      
      // Set account ID and redirect to Stripe
      setAccountId(newAccountId);
      window.location.href = linkData.result.url;
      
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueOnboarding = async () => {
    if (!accountId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/stripe-connect/createAccountLink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message);
      }

      const data = await response.json();
      window.location.href = data.result.url;
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (accountId) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Complete Your Stripe Setup</h2>
        
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold mb-2">Account Created Successfully!</h3>
          <p className="text-gray-600">
            Your Stripe Connect account has been created. Click below to complete the onboarding process with Stripe.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={handleContinueOnboarding}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Loading...' : 'Continue to Stripe Onboarding'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Create Your Stripe Connect Account</h2>
      
      <p className="mb-6 text-gray-600 text-center">
        Connect your Stripe account to start accepting payments through Rebooked.
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleCreateAccount} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="your@email.com"
            required
          />
        </div>

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
            Business Name
          </label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Your Business Name"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating Account...' : 'Create Stripe Connect Account'}
        </button>
      </form>

      <div className="mt-6 p-4 bg-muted/30 rounded-lg">
        <h3 className="font-semibold mb-2">What happens next?</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• We'll create your Stripe Connect account</li>
          <li>• You'll be redirected to Stripe to complete onboarding</li>
          <li>• Once complete, you can start accepting payments</li>
          <li>• We'll handle all the technical integration for you</li>
        </ul>
      </div>
    </div>
  );
};

export default ConnectOnboarding;
