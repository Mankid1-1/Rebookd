import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Telnyx (preferred — pay-per-message, no subscription)
  TELNYX_API_KEY: z.string().optional(),
  TELNYX_FROM_NUMBER: z.string().optional(),
  // Twilio (fallback)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  APP_URL: z.string().optional(),
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be 64 hex chars (32 bytes)").optional(),
  SENTRY_DSN: z.string().optional(),
  WEBHOOK_SECRET: z.string().min(16, "WEBHOOK_SECRET must be at least 16 chars").optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  throw new Error("Invalid environment variables. See logs above for details.");
}

export const env = _env.data;
