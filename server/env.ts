import { z } from "zod";

const envSchema = z.object({
  // ─── Required ─────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),

  // ──��� Payments ─────────────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // ─── SMS: Telnyx (preferred — pay-per-message, no subscription) ───────────
  TELNYX_API_KEY: z.string().optional(),
  TELNYX_FROM_NUMBER: z.string().optional(),

  // ─── SMS: Twilio (fallback) ───────────────────────────────────────────────
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  // ─── Third-party integrations ─────────────────────────────────────────────
  SENDGRID_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  // ─── App configuration ────────────────────────────────────────────────────
  APP_URL: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().transform(Number).pipe(z.number().int().min(1).max(65535)).optional(),

  // ──�� Security ─────────────────────────────────────────────────────────────
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be 64 hex chars (32 bytes)").optional(),
  WEBHOOK_SECRET: z.string().min(16, "WEBHOOK_SECRET must be at least 16 chars").optional(),

  // ─── CORS / Origins ───────────────────────────────────────────────────────
  CORS_ORIGIN: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),

  // ─── Database tuning ──────────────────────────────────────────────────────
  DB_POOL_SIZE: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),

  // ─── Feature flags ────────────────────────────────────────────────────────
  REFERRAL_AUTO_PAYOUT_ENABLED: z.string().optional(),

  // ─── Worker / Sentinel ────────────────────────────────────────────────────
  WORKER_HEARTBEAT_FILE: z.string().optional(),
  SENTINEL_HEARTBEAT_FILE: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  throw new Error("Invalid environment variables. See logs above for details.");
}

export const env = _env.data;
