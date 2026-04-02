export type EnvConfig = {
  databaseUrl: string;
  ownerOpenId: string;
  appId: string;
  oAuthServerUrl: string;
  cookieSecret: string;
  forgeApiUrl: string;
  forgeApiKey: string;
  sendGridApiKey: string;
  emailFromAddress: string;
  encryptionKey: string;
  sentryDsn: string;
  webhookSecret: string;
  // Telnyx (preferred — pay-per-message, no subscription)
  telnyxApiKey: string;
  telnyxFromNumber: string;
  telnyxPublicKey: string;
  // Twilio (fallback)
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
  // Stripe - CRITICAL FOR BILLING
  stripeSecretKey: string;
  stripePublishableKey: string;
  stripeWebhookSecret: string;
  // Flex Spots ($199/mo + 15% revenue share after 35-day trial)
  stripeFlexProductId: string;
  stripeFlexPriceId: string;
  stripeFlexMeteredPriceId: string;
  // Founder Spots ($0/forever)
  stripeFounderProductId: string;
  stripeFounderPriceId: string;
  // Referral Reward ($50/mo)
  stripeReferralProductId: string;
  stripeReferralPriceId: string;
  // Enterprise (custom)
  stripeEnterpriseProductId: string;
  frontendUrl: string;
  backendUrl: string;
  // Referral System
  referralRewardAmount: number;
  referralMinimumMonths: number;
  referralExpiryDays: number;
  referralProgramEnabled: boolean;
  // Calendar Integration
  googleCalendarClientId: string;
  googleCalendarClientSecret: string;
  outlookClientId: string;
  outlookClientSecret: string;
  calendlyClientId: string;
  calendlyClientSecret: string;
  acuityUserId: string;
  acuityApiKey: string;
  // Phoneservice (self-hosted SMS gateway — replaces Telnyx/Twilio)
  phoneserviceUrl: string;
  phoneserviceApiKey: string;
  // TextLinkSMS (primary SMS provider — textlinksms.com)
  textLinkSmsApiKey: string;
  // n8n workflow automation
  n8nBaseUrl: string;
  n8nApiKey: string;
  n8nEnabled: boolean;
  n8nAdminApiKey: string;
  n8nCircuitBreakerThreshold: number;
  n8nCircuitBreakerTimeoutMs: number;
  n8nRetryMaxAttempts: number;
  n8nDlqReprocessIntervalMs: number;
};

export const ENV: EnvConfig = {
  databaseUrl:
    process.env.DATABASE_URL ??
    process.env.RAILWAY_URL ??
    "mysql://root:example@db:3306/rebooked",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "placeholder",
  appId: process.env.VITE_APP_ID ?? "rebooked",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "http://localhost:3000",
  cookieSecret: process.env.JWT_SECRET ?? process.env.COOKIE_SECRET ?? (() => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET or COOKIE_SECRET must be set in production");
    }
    return "rebooked-dev-only-salt";
  })(),
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? process.env.FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? process.env.FORGE_API_KEY ?? "",
  sendGridApiKey: process.env.SENDGRID_API_KEY ?? "",
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS ?? "hello@rebooked.com",
  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
  sentryDsn: process.env.SENTRY_DSN ?? "",
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
  telnyxApiKey: process.env.TELNYX_API_KEY ?? "",
  telnyxFromNumber: process.env.TELNYX_FROM_NUMBER ?? "",
  telnyxPublicKey: process.env.TELNYX_PUBLIC_KEY ?? "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
  // Stripe - CRITICAL FOR BILLING
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  // Flex Spots ($199/mo + 15% revenue share after 35-day trial)
  stripeFlexProductId: process.env.STRIPE_FLEX_PRODUCT_ID ?? "prod_UE6MDIJfGfjOsv",
  stripeFlexPriceId: process.env.STRIPE_FLEX_PRICE_ID ?? "price_1TFe9OPJnVwFKTtaW1lQQKrL",
  stripeFlexMeteredPriceId: process.env.STRIPE_FLEX_METERED_PRICE_ID ?? "price_1TFe9NPJnVwFKTtavqUsUJFe",
  // Founder Spots ($0/forever)
  stripeFounderProductId: process.env.STRIPE_FOUNDER_PRODUCT_ID ?? "prod_UG06wDViOhpNlc",
  stripeFounderPriceId: process.env.STRIPE_FOUNDER_PRICE_ID ?? "price_1THU69PJnVwFKTtaqluytnpJ",
  // Referral Reward ($50/mo)
  stripeReferralProductId: process.env.STRIPE_REFERRAL_PRODUCT_ID ?? "prod_UG06enW7Xbp1cb",
  stripeReferralPriceId: process.env.STRIPE_REFERRAL_PRICE_ID ?? "price_1THU6APJnVwFKTtawj0st9pe",
  // Enterprise (custom)
  stripeEnterpriseProductId: process.env.STRIPE_ENTERPRISE_PRODUCT_ID ?? "prod_UG06w3LBqB1eFz",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  backendUrl: process.env.BACKEND_URL ?? "http://localhost:3001",
  // Referral System
  referralRewardAmount: parseInt(process.env.REFERRAL_REWARD_AMOUNT ?? "50"),
  referralMinimumMonths: parseInt(process.env.REFERRAL_MINIMUM_MONTHS ?? "6"),
  referralExpiryDays: parseInt(process.env.REFERRAL_EXPIRY_DAYS ?? "90"),
  referralProgramEnabled: process.env.REFERRAL_PROGRAM_ENABLED === "true",
  // Calendar Integration
  googleCalendarClientId: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
  googleCalendarClientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
  outlookClientId: process.env.OUTLOOK_CLIENT_ID ?? "",
  outlookClientSecret: process.env.OUTLOOK_CLIENT_SECRET ?? "",
  calendlyClientId: process.env.CALENDLY_CLIENT_ID ?? "",
  calendlyClientSecret: process.env.CALENDLY_CLIENT_SECRET ?? "",
  acuityUserId: process.env.ACUITY_USER_ID ?? "",
  acuityApiKey: process.env.ACUITY_API_KEY ?? "",
  // Phoneservice (self-hosted SMS gateway)
  phoneserviceUrl: process.env.PHONESERVICE_URL ?? "",
  phoneserviceApiKey: process.env.PHONESERVICE_API_KEY ?? "",
  // TextLinkSMS
  textLinkSmsApiKey: process.env.TEXTLINKSMS_API_KEY ?? "",
  // n8n
  n8nBaseUrl: process.env.N8N_BASE_URL ?? "http://localhost:5678",
  n8nApiKey: process.env.N8N_API_KEY ?? "",
  n8nEnabled: process.env.N8N_ENABLED === "true",
  n8nAdminApiKey: process.env.N8N_ADMIN_API_KEY ?? "",
  n8nCircuitBreakerThreshold: parseInt(process.env.N8N_CIRCUIT_BREAKER_THRESHOLD ?? "5"),
  n8nCircuitBreakerTimeoutMs: parseInt(process.env.N8N_CIRCUIT_BREAKER_TIMEOUT_MS ?? "30000"),
  n8nRetryMaxAttempts: parseInt(process.env.N8N_RETRY_MAX_ATTEMPTS ?? "2"),
  n8nDlqReprocessIntervalMs: parseInt(process.env.N8N_DLQ_REPROCESS_INTERVAL_MS ?? "300000"),
};

/** Call at startup to log warnings for missing critical env vars.
 *  In production, missing JWT_SECRET or ENCRYPTION_KEY is FATAL — the process will exit.
 */
export function validateEnv(): void {
  const IS_PRODUCTION = process.env.NODE_ENV === "production";

  const critical: [string, string][] = [
    ["STRIPE_SECRET_KEY", ENV.stripeSecretKey],
    ["STRIPE_WEBHOOK_SECRET", ENV.stripeWebhookSecret],
    ["DATABASE_URL", process.env.DATABASE_URL || process.env.RAILWAY_URL || ""],
  ];

  const fatal: [string, string][] = [
    ["ENCRYPTION_KEY", ENV.encryptionKey],
    ["JWT_SECRET", process.env.JWT_SECRET || ""],
  ];

  const warn: [string, string][] = [
    ["SENTRY_DSN", ENV.sentryDsn],
    ["TELNYX_API_KEY", ENV.telnyxApiKey],
  ];

  // In production, refuse to start with insecure defaults
  if (IS_PRODUCTION && ENV.cookieSecret === "rebooked-salt") {
    console.error("[ENV] FATAL: JWT_SECRET is not set — refusing to start with default secret in production");
    process.exit(1);
  }

  for (const [name, value] of fatal) {
    if (!value && IS_PRODUCTION) {
      console.error(`[ENV] FATAL: ${name} is not set — refusing to start in production without it`);
      process.exit(1);
    }
    if (!value) {
      console.warn(`[ENV] WARNING: ${name} is not set`);
    }
  }

  for (const [name, value] of critical) {
    if (!value) {
      console.warn(`[ENV] CRITICAL: ${name} is not set — feature will fail at runtime`);
    }
  }

  if (ENV.cookieSecret === "rebooked-salt") {
    console.warn("[ENV] WARNING: Using default JWT/cookie secret — set JWT_SECRET for security");
  }

  for (const [name, value] of warn) {
    if (!value) {
      console.warn(`[ENV] WARNING: ${name} is not set`);
    }
  }
}
