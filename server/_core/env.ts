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
};
