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
  // Twilio (fallback)
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
  // Stripe - CRITICAL FOR BILLING
  stripeSecretKey: string;
  stripePublishableKey: string;
  stripeWebhookSecret: string;
  stripeFixedPriceId: string;
  stripeMeteredPriceId: string;
  frontendUrl: string;
  backendUrl: string;
  // Referral System
  referralRewardAmount: number;
  referralMinimumMonths: number;
  referralExpiryDays: number;
  referralProgramEnabled: boolean;
};

export const ENV: EnvConfig = {
  databaseUrl:
    process.env.DATABASE_URL ??
    process.env.RAILWAY_URL ??
    "mysql://root:example@db:3306/rebooked",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "placeholder",
  appId: process.env.VITE_APP_ID ?? "rebooked",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "http://localhost:3000",
  cookieSecret: process.env.JWT_SECRET ?? process.env.COOKIE_SECRET ?? "rebooked-salt",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? process.env.FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? process.env.FORGE_API_KEY ?? "",
  sendGridApiKey: process.env.SENDGRID_API_KEY ?? "",
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS ?? "hello@rebooked.com",
  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
  sentryDsn: process.env.SENTRY_DSN ?? "",
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
  telnyxApiKey: process.env.TELNYX_API_KEY ?? "",
  telnyxFromNumber: process.env.TELNYX_FROM_NUMBER ?? "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
  // Stripe - CRITICAL FOR BILLING
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripeFixedPriceId: process.env.STRIPE_FIXED_PRICE_ID ?? "price_FIXED_199",
  stripeMeteredPriceId: process.env.STRIPE_METERED_PRICE_ID ?? "price_METERED_15",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  backendUrl: process.env.BACKEND_URL ?? "http://localhost:3001",
  // Referral System
  referralRewardAmount: parseInt(process.env.REFERRAL_REWARD_AMOUNT ?? "50"),
  referralMinimumMonths: parseInt(process.env.REFERRAL_MINIMUM_MONTHS ?? "6"),
  referralExpiryDays: parseInt(process.env.REFERRAL_EXPIRY_DAYS ?? "90"),
  referralProgramEnabled: process.env.REFERRAL_PROGRAM_ENABLED === "true",
};

/** Call at startup to log warnings for missing critical env vars. */
export function validateEnv(): void {
  const critical: [string, string][] = [
    ["ENCRYPTION_KEY", ENV.encryptionKey],
    ["STRIPE_SECRET_KEY", ENV.stripeSecretKey],
    ["STRIPE_WEBHOOK_SECRET", ENV.stripeWebhookSecret],
    ["DATABASE_URL", process.env.DATABASE_URL || process.env.RAILWAY_URL || ""],
  ];

  const warn: [string, string][] = [
    ["SENTRY_DSN", ENV.sentryDsn],
    ["TELNYX_API_KEY", ENV.telnyxApiKey],
    ["JWT_SECRET", process.env.JWT_SECRET || ""],
  ];

  for (const [name, value] of critical) {
    if (!value) {
      console.warn(`[ENV] CRITICAL: ${name} is not set — feature will fail at runtime`);
    }
  }

  if (ENV.cookieSecret === "rebooked-salt") {
    console.warn("[ENV] WARNING: Using default JWT/cookie secret — set JWT_SECRET in production");
  }

  for (const [name, value] of warn) {
    if (!value) {
      console.warn(`[ENV] WARNING: ${name} is not set`);
    }
  }
}
