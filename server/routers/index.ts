import { router } from "../_core/trpc";
import { authRouter, apiKeysRouter } from "./auth.router";
import { leadsRouter } from "./lead.router";
import { automationsRouter, aiRouter } from "./automation.router";
import { templatesRouter } from "./template.router";
import { tenantRouter, onboardingRouter } from "./tenant.router";
import { analyticsRouter } from "./analytics.router";
import { billingRouter, plansRouter } from "./billing.router";
import { adminRouter } from "./admin.router";
import { webhooksRouter } from "./webhook.router";
import { referralRouter } from "./referral.router";

export const appRouter = router({
  auth: authRouter,
  leads: leadsRouter,
  automations: automationsRouter,
  ai: aiRouter,
  templates: templatesRouter,
  apiKeys: apiKeysRouter,
  webhooks: webhooksRouter,
  tenant: tenantRouter,
  analytics: analyticsRouter,
  plans: plansRouter,
  billing: billingRouter,
  onboarding: onboardingRouter,
  admin: adminRouter,
  referral: referralRouter,
});

export type AppRouter = typeof appRouter;
