import { router } from "../_core/trpc";
import { authRouter, apiKeysRouter } from "./auth.router";
import { leadsRouter } from "./lead.router";
import { automationsRouter, aiRouter } from "./automation.router";
import { templatesRouter } from "./template.router";
import { tenantRouter, onboardingRouter, featureConfigRouter } from "./tenant.router";
import { analyticsRouter } from "./analytics.router";
import { billingRouter, plansRouter } from "./billing.router";
import { adminRouter } from "./admin.router";
import { webhooksRouter } from "./webhook.router";
import { referralRouter } from "./referral.router";
import { calendarRouter } from "./calendar.router";
import { contactImportRouter } from "./contact-import.router";
import { segmentRouter } from "./segment.router";
import { n8nRouter } from "./n8n.router";
import { n8nAdminRouter } from "./n8n-admin.router";
import {
  locationsRouter,
  notificationsRouter,
  userRouter,
  integrationsRouter,
  featureFlagsRouter,
  personalizationRouter,
  reportsRouter,
  schedulingRouter,
  platformStatsRouter,
  miscRouter,
} from "./misc.router";

export const appRouter = router({
  auth: authRouter,
  leads: leadsRouter,
  automations: automationsRouter,
  ai: aiRouter,
  templates: templatesRouter,
  apiKeys: apiKeysRouter,
  webhooks: webhooksRouter,
  tenant: tenantRouter,
  featureConfig: featureConfigRouter,
  analytics: analyticsRouter,
  plans: plansRouter,
  billing: billingRouter,
  onboarding: onboardingRouter,
  admin: adminRouter,
  referral: referralRouter,
  calendar: calendarRouter,
  contactImport: contactImportRouter,
  segment: segmentRouter,
  n8n: n8nRouter,
  n8nAdmin: n8nAdminRouter,
  // Stub routers for procedures expected by frontend components/hooks
  locations: locationsRouter,
  notifications: notificationsRouter,
  user: userRouter,
  integrations: integrationsRouter,
  featureFlags: featureFlagsRouter,
  personalization: personalizationRouter,
  reports: reportsRouter,
  scheduling: schedulingRouter,
  platformStats: platformStatsRouter,
  misc: miscRouter,
});

export type AppRouter = typeof appRouter;
