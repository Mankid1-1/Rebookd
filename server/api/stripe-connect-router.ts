/**
 * 🚀 STRIPE CONNECT ROUTER INTEGRATION
 * Main router for all Stripe Connect functionality
 */

import { router } from '../_core/trpc';
import stripeConnectRouter from './stripe-connect';
import stripeWebhookRouter from './stripe-webhooks';

// Combine all Stripe Connect routes
export const stripeConnectMainRouter = router({
  // Account Management
  createConnectAccount: stripeConnectRouter.createConnectAccount,
  createAccountLink: stripeConnectRouter.createAccountLink,
  getAccountStatus: stripeConnectRouter.getAccountStatus,
  
  // Product Management
  createProduct: stripeConnectRouter.createProduct,
  getProducts: stripeConnectRouter.getProducts,
  
  // Checkout & Billing
  createCheckoutSession: stripeConnectRouter.createCheckoutSession,
  createPortalSession: stripeConnectRouter.createPortalSession,
  subscribeToPlatform: stripeConnectRouter.subscribeToPlatform,
  
  // Webhooks
  processWebhookEvent: stripeWebhookRouter.processWebhookEvent,
});

export default stripeConnectMainRouter;
