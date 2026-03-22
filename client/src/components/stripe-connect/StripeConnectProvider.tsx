/**
 * 🚀 STRIPE CONNECT PROVIDER
 * React context for managing Stripe Connect account state
 * Based on Stripe sample code with Rebooked integration
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

interface StripeConnectContextType {
  accountId: string | null;
  setAccountId: (accountId: string | null) => void;
  isLoading: boolean;
  needsOnboarding: boolean;
  accountStatus: any | null;
}

const StripeConnectContext = createContext<StripeConnectContextType | undefined>(undefined);

export const useStripeConnect = () => {
  const context = useContext(StripeConnectContext);
  if (!context) {
    throw new Error('useStripeConnect must be used within a StripeConnectProvider');
  }
  return context;
};

export const StripeConnectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accountId, setAccountId] = useState<string | null>(() => {
    // Initialize from localStorage
    return localStorage.getItem('stripe_connect_account_id');
  });

  const [isLoading, setIsLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [accountStatus, setAccountStatus] = useState<any>(null);

  useEffect(() => {
    if (accountId) {
      localStorage.setItem('stripe_connect_account_id', accountId);
    } else {
      localStorage.removeItem('stripe_connect_account_id');
    }
  }, [accountId]);

  // Check account status when accountId changes
  useEffect(() => {
    const checkAccountStatus = async () => {
      if (!accountId) return;
      
      setIsLoading(true);
      try {
        const response = await fetch('/api/stripe-connect/getAccountStatus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setAccountStatus(data.result.status);
          setNeedsOnboarding(!data.result.status.details_submitted);
        }
      } catch (error) {
        console.error('Error checking account status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccountStatus();
  }, [accountId]);

  const value: StripeConnectContextType = {
    accountId,
    setAccountId,
    isLoading,
    needsOnboarding,
    accountStatus,
  };

  return (
    <StripeConnectContext.Provider value={value}>
      {children}
    </StripeConnectContext.Provider>
  );
};

export default StripeConnectProvider;
