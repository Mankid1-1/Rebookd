/**
 * 🚀 STRIPE CONNECT PAGE
 * Main page for Stripe Connect integration
 * Based on Stripe sample code with Rebooked integration
 */

import React from 'react';
import StripeConnectProvider, { useStripeConnect } from '../components/stripe-connect/StripeConnectProvider';
import ConnectDashboard from '../components/stripe-connect/ConnectDashboard';

const StripeConnect: React.FC = () => {
  return (
    <StripeConnectProvider>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <img 
                    className="h-8 w-8" 
                    src="https://img.icons8.com/color/48/stripe.png" 
                    alt="Stripe Connect"
                  />
                </div>
                <div className="ml-4">
                  <h1 className="text-2xl font-bold text-white">Stripe Connect</h1>
                  <p className="text-blue-100">Multi-tenant Payment Platform</p>
                </div>
              </div>
              
              <div className="ml-10 flex items-center">
                <a 
                  href="https://dashboard.stripe.com/login" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Stripe Dashboard
                </a>
              </div>
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <ConnectDashboard />
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <p className="text-gray-500 text-sm">
                © 2024 Rebooked. Powered by Stripe Connect.
              </p>
              <div className="flex space-x-6">
                <a href="#" className="text-gray-400 hover:text-gray-500 text-sm">
                  Documentation
                </a>
                <a href="#" className="text-gray-400 hover:text-gray-500 text-sm">
                  Support
                </a>
                <a href="#" className="text-gray-400 hover:text-gray-500 text-sm">
                  API
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </StripeConnectProvider>
  );
};

export default StripeConnect;
