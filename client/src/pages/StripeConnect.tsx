/**
 * 🚀 STRIPE CONNECT PAGE
 * Main page for Stripe Connect integration
 * Based on Stripe sample code with Rebooked integration
 */

import React from 'react';
import StripeConnectProvider, { useStripeConnect } from '../components/stripe-connect/StripeConnectProvider';
import ConnectDashboard from '../components/stripe-connect/ConnectDashboard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const StripeConnect: React.FC = () => {
  return (
    <DashboardLayout>
      <StripeConnectProvider>
        <div className="min-h-screen">
          <div className="bg-gradient-to-r from-info to-accent">
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
                  <HelpTooltip content="Connect your Stripe account so Rebooked can track revenue recovered and calculate your 15% revenue share." variant="info">
                    <h1 className="text-2xl font-bold text-white">Stripe Connect</h1>
                  </HelpTooltip>
                  <HelpTooltip content="Rebooked supports multiple businesses on one platform. Each business's payments, data, and settings are fully isolated from other accounts." variant="info">
                    <p className="text-info-foreground/80">Multi-tenant Payment Platform</p>
                  </HelpTooltip>
                </div>
              </div>
              
              <div className="ml-10 flex items-center gap-3">
                <HelpTooltip content="15% of revenue recovered through Rebooked is billed monthly via Stripe. Connect your account to enable automatic tracking." variant="info">
                  <span className="text-info-foreground/80 text-sm">Revenue Share</span>
                </HelpTooltip>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href="https://dashboard.stripe.com/login"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        Stripe Dashboard
                      </a>
                    </TooltipTrigger>
                    <TooltipContent><p>Opens your Stripe account dashboard in a new tab — view payouts, disputes, and transaction history.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <ConnectDashboard />
        </main>

        {/* Footer */}
        <footer className="bg-card border-t border-border">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <p className="text-muted-foreground text-sm">
                © 2024 Rebooked. Powered by Stripe Connect.
              </p>
              <div className="flex space-x-6">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href="#" className="text-muted-foreground hover:text-foreground text-sm">Documentation</a>
                    </TooltipTrigger>
                    <TooltipContent><p>View the Stripe Connect integration guide and setup instructions.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href="#" className="text-muted-foreground hover:text-foreground text-sm">Support</a>
                    </TooltipTrigger>
                    <TooltipContent><p>Get help with your Stripe Connect setup or payment issues from the Rebooked team.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href="#" className="text-muted-foreground hover:text-foreground text-sm">API</a>
                    </TooltipTrigger>
                    <TooltipContent><p>Browse the Stripe API reference to customise your payment integration.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </StripeConnectProvider>
    </DashboardLayout>
  );
};

export default StripeConnect;
