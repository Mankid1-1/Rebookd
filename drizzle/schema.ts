import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  index,
} from "drizzle-orm/mysql-core";

// ─── Core Auth ────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  tenantId: int("tenantId"),
  active: boolean("active").default(true).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
  tenantIdIdx: index("users_tenant_id_idx").on(t.tenantId),
  openIdIdx: uniqueIndex("users_open_id_idx").on(t.openId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const emailVerificationTokens = mysqlTable("email_verification_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Tenants ──────────────────────────────────────────────────────────────────

export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  timezone: varchar("timezone", { length: 64 }).default("America/New_York").notNull(),
  industry: varchar("industry", { length: 100 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

// ─── Plans & Subscriptions ────────────────────────────────────────────────────

export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  priceMonthly: int("priceMonthly").default(0).notNull(),
  maxAutomations: int("maxAutomations").default(5).notNull(),
  maxMessages: int("maxMessages").default(500).notNull(),
  maxSeats: int("maxSeats").default(1).notNull(),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  revenueSharePercent: int("revenueSharePercent").default(0).notNull(),
  promotionalSlots: int("promotionalSlots").default(0).notNull(),
  promotionalPriceCap: int("promotionalPriceCap").default(0).notNull(),
  hasPromotion: boolean("hasPromotion").default(false).notNull(),
  features: json("features").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Plan = typeof plans.$inferSelect;

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  planId: int("planId").notNull(),
  stripeId: varchar("stripeId", { length: 255 }),
  status: mysqlEnum("status", ["active", "trialing", "past_due", "canceled", "unpaid"]).default("trialing").notNull(),
  trialEndsAt: timestamp("trialEndsAt"),
  trialReminderSent: boolean("trialReminderSent").default(false).notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  isPromotional: boolean("isPromotional").default(false).notNull(),
  promotionalExpiresAt: timestamp("promotionalExpiresAt"),
  // ROI Guarantee fields
  guaranteeCohort: mysqlEnum("guaranteeCohort", ["risk_free_20", "flex_10"]),
  guaranteeStatus: mysqlEnum("guaranteeStatus", ["active", "satisfied", "refunded", "expired"]),
  guaranteeStartedAt: timestamp("guaranteeStartedAt"),
  guaranteeExpiresAt: timestamp("guaranteeExpiresAt"),
  lastRoiCheckAt: timestamp("lastRoiCheckAt"),
  lastRoiAmount: int("lastRoiAmount"), // in cents, client's net ROI
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;

export const billingInvoices = mysqlTable("billing_invoices", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  subscriptionId: int("subscriptionId"),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 255 }).notNull().unique(),
  stripeChargeId: varchar("stripeChargeId", { length: 255 }),
  number: varchar("number", { length: 128 }),
  status: varchar("status", { length: 64 }).notNull(),
  currency: varchar("currency", { length: 16 }).notNull(),
  subtotal: int("subtotal").default(0).notNull(),
  total: int("total").default(0).notNull(),
  amountPaid: int("amountPaid").default(0).notNull(),
  amountRemaining: int("amountRemaining").default(0).notNull(),
  hostedInvoiceUrl: varchar("hostedInvoiceUrl", { length: 500 }),
  invoicePdfUrl: varchar("invoicePdfUrl", { length: 500 }),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BillingInvoice = typeof billingInvoices.$inferSelect;

export const billingRefunds = mysqlTable("billing_refunds", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  subscriptionId: int("subscriptionId"),
  billingInvoiceId: int("billingInvoiceId"),
  stripeRefundId: varchar("stripeRefundId", { length: 255 }).notNull().unique(),
  stripeChargeId: varchar("stripeChargeId", { length: 255 }),
  amount: int("amount").notNull(),
  currency: varchar("currency", { length: 16 }).notNull(),
  reason: varchar("reason", { length: 100 }),
  status: varchar("status", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BillingRefund = typeof billingRefunds.$inferSelect;

// ─── Usage ────────────────────────────────────────────────────────────────────

export const usage = mysqlTable("usage", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  messagesSent: int("messagesSent").default(0).notNull(),
  automationsRun: int("automationsRun").default(0).notNull(),
  hasUsageAlerted: boolean("hasUsageAlerted").default(false).notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Usage = typeof usage.$inferSelect;

// ─── Phone Numbers ────────────────────────────────────────────────────────────

export const phoneNumbers = mysqlTable("phone_numbers", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  number: varchar("number", { length: 20 }).notNull().unique(),
  label: varchar("label", { length: 100 }),
  isDefault: boolean("isDefault").default(false).notNull(),
  isInbound: boolean("isInbound").default(false).notNull(),
  twilioSid: varchar("twilioSid", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type PhoneNumber = typeof phoneNumbers.$inferSelect;

// ─── Leads ────────────────────────────────────────────────────────────────────

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  phoneHash: varchar("phoneHash", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  status: mysqlEnum("status", ["new", "contacted", "qualified", "booked", "lost", "unsubscribed"]).default("new").notNull(),
  source: varchar("source", { length: 100 }),
  tags: json("tags").$type<string[]>(),
  notes: text("notes"),
  lastMessageAt: timestamp("lastMessageAt"),
  lastInboundAt: timestamp("lastInboundAt"),
  appointmentAt: timestamp("appointmentAt"),
  // TCPA Compliance fields
  smsConsentAt: timestamp("smsConsentAt"),
  smsConsentSource: varchar("smsConsentSource", { length: 100 }), // "form", "manual", "import", etc.
  tcpaConsentText: text("tcpaConsentText"), // Store the exact consent language
  unsubscribedAt: timestamp("unsubscribedAt"),
  unsubscribeMethod: varchar("unsubscribeMethod", { length: 50 }), // "sms_stop", "manual", etc.
  recoverySource: varchar("recoverySource", { length: 100 }), // "rebookd_automation", "manual", etc.
  recoveredFromLeadId: int("recoveredFromLeadId"), // Links to original canceled/no-show lead
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tenantIdIdx: index("leads_tenant_id_idx").on(t.tenantId),
  phoneHashIdx: uniqueIndex("leads_phone_hash_idx").on(t.tenantId, t.phoneHash),
  statusIdx: index("leads_status_idx").on(t.tenantId, t.status),
  createdAtIdx: index("leads_created_at_idx").on(t.tenantId, t.createdAt),
  searchIdx: index("leads_search_idx").on(t.tenantId, t.phone, t.name, t.email),
  consentIdx: index("leads_consent_idx").on(t.tenantId, t.smsConsentAt),
}));

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  leadId: int("leadId").notNull(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  body: text("body").notNull(),
  fromNumber: varchar("fromNumber", { length: 20 }),
  toNumber: varchar("toNumber", { length: 20 }),
  twilioSid: varchar("twilioSid", { length: 100 }),
  status: mysqlEnum("status", ["queued", "sent", "delivered", "failed", "received"]).default("queued").notNull(),
  provider: varchar("provider", { length: 50 }),
  providerError: text("providerError"),
  retryCount: int("retryCount").default(0).notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 64 }),
  deliveredAt: timestamp("deliveredAt"),
  failedAt: timestamp("failedAt"),
  aiRewritten: boolean("aiRewritten").default(false).notNull(),
  tone: varchar("tone", { length: 50 }),
  automationId: int("automationId"),
  recoveryEventId: int("recoveryEventId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  tenantIdIdx: index("messages_tenant_id_idx").on(t.tenantId),
  leadIdIdx: index("messages_lead_id_idx").on(t.leadId),
  tenantLeadIdx: index("messages_tenant_lead_idx").on(t.tenantId, t.leadId),
  createdAtIdx: index("messages_created_at_idx").on(t.tenantId, t.createdAt),
  idempotencyKeyIdx: uniqueIndex("messages_idempotency_key_idx").on(t.tenantId, t.idempotencyKey),
  recoveryEventIdx: index("messages_recovery_event_idx").on(t.recoveryEventId),
}));

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─── Templates ────────────────────────────────────────────────────────────────

export const templates = mysqlTable("templates", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  body: text("body").notNull(),
  tone: mysqlEnum("tone", ["friendly", "professional", "casual", "urgent", "empathetic"]).default("friendly").notNull(),
  variables: json("variables").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;

// ─── Automations ──────────────────────────────────────────────────────────────

export const automations = mysqlTable("automations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  category: mysqlEnum("category", ["follow_up", "reactivation", "appointment", "welcome", "custom", "no_show", "cancellation", "loyalty"]).default("custom").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  triggerType: mysqlEnum("triggerType", ["new_lead", "inbound_message", "status_change", "time_delay", "appointment_reminder"]).default("new_lead").notNull(),
  triggerConfig: json("triggerConfig").$type<Record<string, unknown>>(),
  conditions: json("conditions").$type<Array<Record<string, unknown>>>(),
  actions: json("actions").$type<Array<Record<string, unknown>>>(),
  runCount: int("runCount").default(0).notNull(),
  errorCount: int("errorCount").default(0).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = typeof automations.$inferInsert;

export const automationJobs = mysqlTable("automation_jobs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  automationId: int("automationId").notNull(),
  leadId: int("leadId"),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  eventData: json("eventData").$type<Record<string, unknown>>(),
  stepIndex: int("stepIndex").default(0).notNull(),
  nextRunAt: timestamp("nextRunAt").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled"]).default("pending").notNull(),
  attempts: int("attempts").default(0).notNull(),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AutomationJob = typeof automationJobs.$inferSelect;

// ─── AI Message Logs ──────────────────────────────────────────────────────────

export const aiMessageLogs = mysqlTable("ai_message_logs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  leadId: int("leadId"),
  original: text("original").notNull(),
  rewritten: text("rewritten"),
  tone: varchar("tone", { length: 50 }).notNull(),
  success: boolean("success").default(true).notNull(),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIMessageLog = typeof aiMessageLogs.$inferSelect;

// ─── Webhook Logs ─────────────────────────────────────────────────────────────

export const webhookLogs = mysqlTable("webhook_logs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  url: varchar("url", { length: 500 }).notNull(),
  payload: text("payload").notNull(),
  statusCode: int("statusCode"),
  error: text("error"),
  attempts: int("attempts").default(0).notNull(),
  nextRetryAt: timestamp("nextRetryAt"),
  resolved: boolean("resolved").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WebhookLog = typeof webhookLogs.$inferSelect;

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  keyHash: varchar("keyHash", { length: 255 }).notNull(),
  keyPrefix: varchar("keyPrefix", { length: 10 }).notNull(),
  label: varchar("label", { length: 100 }),
  active: boolean("active").default(true).notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;

// ─── System Error Logs ────────────────────────────────────────────────────────

export const systemErrorLogs = mysqlTable("system_error_logs", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["twilio", "ai", "automation", "billing", "webhook"]).notNull(),
  message: text("message").notNull(),
  detail: text("detail"),
  tenantId: int("tenantId"),
  resolved: boolean("resolved").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemErrorLog = typeof systemErrorLogs.$inferSelect;

export const adminAuditLogs = mysqlTable("admin_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  adminEmail: varchar("adminEmail", { length: 320 }),
  action: varchar("action", { length: 120 }).notNull(),
  targetTenantId: int("targetTenantId"),
  targetUserId: int("targetUserId"),
  route: varchar("route", { length: 255 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;

export const smsRateLimits = mysqlTable("sms_rate_limits", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  windowStart: timestamp("windowStart").notNull(),
  count: int("count").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const llmCircuitBreakers = mysqlTable("llm_circuit_breakers", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  state: mysqlEnum("state", ["closed", "open", "half_open"]).default("closed").notNull(),
  consecutiveFailures: int("consecutiveFailures").default(0).notNull(),
  openedAt: timestamp("openedAt"),
  cooldownUntil: timestamp("cooldownUntil"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Idempotency keys for inbound custom webhooks (trpc webhooks.receive) */
export const webhookReceiveDedupes = mysqlTable(
  "webhook_receive_dedupes",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull(),
    dedupeKey: varchar("dedupeKey", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    tenantDedupeUid: uniqueIndex("webhook_receive_dedupes_tenant_dedupe_uidx").on(t.tenantId, t.dedupeKey),
  }),
);

export const authRateLimits = mysqlTable("auth_rate_limits", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  emailCreatedIdx: uniqueIndex("auth_rate_limits_email_created_idx").on(t.email, t.createdAt),
}));

// ─── Referral System ─────────────────────────────────────────────────

// Referral system tables
export const referrals = mysqlTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: int("referrer_id").notNull(),
  referredUserId: int("referred_user_id").notNull(),
  referralCode: varchar("referral_code", { length: 16 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "completed", "expired", "cancelled"]).default("pending").notNull(),
  subscriptionId: varchar("subscription_id", { length: 255 }),
  rewardAmount: int("reward_amount").default(50).notNull(),
  rewardCurrency: varchar("reward_currency", { length: 3 }).default("USD").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at").notNull(),
  payoutScheduledAt: timestamp("payout_scheduled_at"), // When payout should be processed
  payoutProcessedAt: timestamp("payout_processed_at"), // When payout was actually processed
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  metadata: json("metadata"),
}, (table) => ({
  referrerIdIdx: index("idx_referrals_referrer_id").on(table.referrerId),
  referredUserIdIdx: index("idx_referrals_referred_user_id").on(table.referredUserId),
  statusIdx: index("idx_referrals_status").on(table.status),
  expiresAtIdx: index("idx_referrals_expires_at").on(table.expiresAt),
  payoutScheduledAtIdx: index("idx_referrals_payout_scheduled_at").on(table.payoutScheduledAt),
}));

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

export const referralPayouts = mysqlTable("referral_payouts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  method: mysqlEnum("method", ["paypal", "stripe", "bank_transfer"]).default("paypal").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
  transactionId: varchar("transactionId", { length: 255 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReferralPayout = typeof referralPayouts.$inferSelect;
export type InsertReferralPayout = typeof referralPayouts.$inferInsert;

// Subscriptions table for Stripe integration
export const stripeSubscriptions = mysqlTable("stripe_subscriptions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: int("user_id").notNull(),
  tenantId: int("tenant_id").notNull(),
  customerId: varchar("customer_id", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  priceId: varchar("price_id", { length: 255 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  trialEnd: timestamp("trial_end"),
  canceledAt: timestamp("canceled_at"),
  endedAt: timestamp("ended_at"),
  latestInvoiceId: varchar("latest_invoice_id", { length: 255 }),
  paymentMethodId: varchar("payment_method_id", { length: 255 }),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_subscriptions_user_id").on(table.userId),
  tenantIdIdx: index("idx_subscriptions_tenant_id").on(table.tenantId),
  customerIdIdx: index("idx_subscriptions_customer_id").on(table.customerId),
  statusIdx: index("idx_subscriptions_status").on(table.status),
}));

export type StripeSubscription = typeof stripeSubscriptions.$inferSelect;
export type InsertStripeSubscription = typeof stripeSubscriptions.$inferInsert;

// ─── Revenue Recovery Attribution ────────────────────────────────────────────

/**
 * Tracks every recovery event from trigger to payment.
 * Each SMS automation that targets a lead creates a recovery_event.
 * When the lead rebooks, the event is marked converted.
 * When payment is captured, the event is marked realized.
 */
export const recoveryEvents = mysqlTable("recovery_events", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  leadId: int("leadId").notNull(),
  /** The automation that triggered this recovery attempt */
  automationId: int("automationId"),
  /** The message that was sent for this recovery attempt */
  messageId: int("messageId"),
  /** Original canceled/no-show appointment this recovery targets */
  originalAppointmentId: varchar("originalAppointmentId", { length: 255 }),
  /** New appointment booked as a result of this recovery */
  recoveredAppointmentId: varchar("recoveredAppointmentId", { length: 255 }),
  /** Leakage type: no_show, cancellation, followup_missed, etc. */
  leakageType: varchar("leakageType", { length: 100 }).notNull(),
  /** Current status of the recovery attempt */
  status: mysqlEnum("status", [
    "sent",           // SMS sent, awaiting response
    "responded",      // Customer responded but hasn't booked
    "converted",      // Customer rebooked (potential revenue)
    "realized",       // Payment captured in Stripe (actual revenue)
    "manual_realized",// Manually marked as recovered (off-platform payment)
    "failed",         // Recovery attempt failed / no response
    "expired",        // Recovery window expired
  ]).default("sent").notNull(),
  /** Unique tracking token embedded in SMS for attribution */
  trackingToken: varchar("trackingToken", { length: 64 }).notNull(),
  /** Stripe Payment Intent ID when payment is captured */
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  /** Stripe Invoice ID for reconciliation */
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 255 }),
  /** Estimated revenue at time of booking */
  estimatedRevenue: int("estimatedRevenue").default(0).notNull(),
  /** Actual realized revenue from Stripe (cents) */
  realizedRevenue: int("realizedRevenue").default(0).notNull(),
  /** Attribution model used: first_touch, last_touch */
  attributionModel: varchar("attributionModel", { length: 50 }).default("last_touch").notNull(),
  /** Whether this is the winning attribution (dedup flag) */
  isPrimaryAttribution: boolean("isPrimaryAttribution").default(false).notNull(),
  /** Notes for manual reconciliation */
  notes: text("notes"),
  /** When the recovery SMS was sent */
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  /** When the customer responded */
  respondedAt: timestamp("respondedAt"),
  /** When the customer rebooked */
  convertedAt: timestamp("convertedAt"),
  /** When payment was captured */
  realizedAt: timestamp("realizedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tenantIdx: index("recovery_events_tenant_idx").on(t.tenantId),
  leadIdx: index("recovery_events_lead_idx").on(t.tenantId, t.leadId),
  trackingTokenIdx: uniqueIndex("recovery_events_tracking_token_idx").on(t.trackingToken),
  statusIdx: index("recovery_events_status_idx").on(t.tenantId, t.status),
  automationIdx: index("recovery_events_automation_idx").on(t.tenantId, t.automationId),
  realizedAtIdx: index("recovery_events_realized_at_idx").on(t.tenantId, t.realizedAt),
}));

export type RecoveryEvent = typeof recoveryEvents.$inferSelect;
export type InsertRecoveryEvent = typeof recoveryEvents.$inferInsert;

// ─── Feature Configs ─────────────────────────────────────────────────────────

/**
 * Per-tenant feature configuration storage.
 * Each row stores the JSON config for one feature (e.g. "lead_capture",
 * "booking_conversion") scoped to a tenant.
 */
export const featureConfigs = mysqlTable("feature_configs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  feature: varchar("feature", { length: 100 }).notNull(),
  config: json("config").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tenantFeatureIdx: uniqueIndex("feature_configs_tenant_feature_idx").on(t.tenantId, t.feature),
}));

export type FeatureConfig = typeof featureConfigs.$inferSelect;
export type InsertFeatureConfig = typeof featureConfigs.$inferInsert;
