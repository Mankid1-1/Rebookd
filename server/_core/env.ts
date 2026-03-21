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
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
};

export const ENV: EnvConfig = {
  databaseUrl:
    process.env.DATABASE_URL ??
    process.env.RAILWAY_URL ??
    "mysql://root:hZuySTkRmnlKMBwjIoirhLVErKiSuazW@autorack.proxy.rlwy.net:32028/railway",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "placeholder",
  appId: process.env.VITE_APP_ID ?? "rebookd",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "http://localhost:3000",
  cookieSecret: process.env.JWT_SECRET ?? process.env.COOKIE_SECRET ?? "rebookd-salt",
  forgeApiUrl:
    process.env.BUILT_IN_FORGE_API_URL ??
    process.env.FORGE_API_URL ??
    "",
  forgeApiKey:
    process.env.BUILT_IN_FORGE_API_KEY ??
    process.env.FORGE_API_KEY ??
    "",
  sendGridApiKey: process.env.SENDGRID_API_KEY ?? "",
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS ?? "hello@rebookd.com",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
};
