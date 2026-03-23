var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc8) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc8 = __getOwnPropDesc(from, key)) || desc8.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  adminAuditLogs: () => adminAuditLogs,
  aiMessageLogs: () => aiMessageLogs,
  apiKeys: () => apiKeys,
  authRateLimits: () => authRateLimits,
  automationJobs: () => automationJobs,
  automations: () => automations,
  billingInvoices: () => billingInvoices,
  billingRefunds: () => billingRefunds,
  emailVerificationTokens: () => emailVerificationTokens,
  leads: () => leads,
  llmCircuitBreakers: () => llmCircuitBreakers,
  messages: () => messages,
  passwordResetTokens: () => passwordResetTokens,
  phoneNumbers: () => phoneNumbers,
  plans: () => plans,
  referralPayouts: () => referralPayouts,
  referrals: () => referrals,
  smsRateLimits: () => smsRateLimits,
  stripeSubscriptions: () => stripeSubscriptions,
  subscriptions: () => subscriptions,
  systemErrorLogs: () => systemErrorLogs,
  templates: () => templates,
  tenants: () => tenants,
  usage: () => usage,
  users: () => users,
  webhookLogs: () => webhookLogs,
  webhookReceiveDedupes: () => webhookReceiveDedupes
});
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
  index
} from "drizzle-orm/mysql-core";
var users, emailVerificationTokens, passwordResetTokens, tenants, plans, subscriptions, billingInvoices, billingRefunds, usage, phoneNumbers, leads, messages, templates, automations, automationJobs, aiMessageLogs, webhookLogs, apiKeys, systemErrorLogs, adminAuditLogs, smsRateLimits, llmCircuitBreakers, webhookReceiveDedupes, authRateLimits, referrals, referralPayouts, stripeSubscriptions;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    users = mysqlTable("users", {
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
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    }, (t) => ({
      emailIdx: uniqueIndex("users_email_idx").on(t.email),
      tenantIdIdx: index("users_tenant_id_idx").on(t.tenantId),
      openIdIdx: uniqueIndex("users_open_id_idx").on(t.openId)
    }));
    emailVerificationTokens = mysqlTable("email_verification_tokens", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      email: varchar("email", { length: 320 }).notNull(),
      tokenHash: varchar("tokenHash", { length: 255 }).notNull(),
      expiresAt: timestamp("expiresAt").notNull(),
      consumedAt: timestamp("consumedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    passwordResetTokens = mysqlTable("password_reset_tokens", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      tokenHash: varchar("tokenHash", { length: 255 }).notNull(),
      expiresAt: timestamp("expiresAt").notNull(),
      consumedAt: timestamp("consumedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    tenants = mysqlTable("tenants", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 255 }).notNull(),
      slug: varchar("slug", { length: 100 }).notNull().unique(),
      timezone: varchar("timezone", { length: 64 }).default("America/New_York").notNull(),
      industry: varchar("industry", { length: 100 }),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    plans = mysqlTable("plans", {
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
      features: json("features").$type(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    subscriptions = mysqlTable("subscriptions", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    billingInvoices = mysqlTable("billing_invoices", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    billingRefunds = mysqlTable("billing_refunds", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    usage = mysqlTable("usage", {
      id: int("id").autoincrement().primaryKey(),
      tenantId: int("tenantId").notNull(),
      messagesSent: int("messagesSent").default(0).notNull(),
      automationsRun: int("automationsRun").default(0).notNull(),
      hasUsageAlerted: boolean("hasUsageAlerted").default(false).notNull(),
      periodStart: timestamp("periodStart").notNull(),
      periodEnd: timestamp("periodEnd").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    phoneNumbers = mysqlTable("phone_numbers", {
      id: int("id").autoincrement().primaryKey(),
      tenantId: int("tenantId").notNull(),
      number: varchar("number", { length: 20 }).notNull().unique(),
      label: varchar("label", { length: 100 }),
      isDefault: boolean("isDefault").default(false).notNull(),
      isInbound: boolean("isInbound").default(false).notNull(),
      twilioSid: varchar("twilioSid", { length: 100 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      deletedAt: timestamp("deletedAt")
    });
    leads = mysqlTable("leads", {
      id: int("id").autoincrement().primaryKey(),
      tenantId: int("tenantId").notNull(),
      phone: varchar("phone", { length: 20 }).notNull(),
      phoneHash: varchar("phoneHash", { length: 64 }).notNull(),
      name: varchar("name", { length: 255 }),
      email: varchar("email", { length: 320 }),
      status: mysqlEnum("status", ["new", "contacted", "qualified", "booked", "lost", "unsubscribed"]).default("new").notNull(),
      source: varchar("source", { length: 100 }),
      tags: json("tags").$type(),
      notes: text("notes"),
      lastMessageAt: timestamp("lastMessageAt"),
      lastInboundAt: timestamp("lastInboundAt"),
      appointmentAt: timestamp("appointmentAt"),
      // TCPA Compliance fields
      smsConsentAt: timestamp("smsConsentAt"),
      smsConsentSource: varchar("smsConsentSource", { length: 100 }),
      // "form", "manual", "import", etc.
      tcpaConsentText: text("tcpaConsentText"),
      // Store the exact consent language
      unsubscribedAt: timestamp("unsubscribedAt"),
      unsubscribeMethod: varchar("unsubscribeMethod", { length: 50 }),
      // "sms_stop", "manual", etc.
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t) => ({
      tenantIdIdx: index("leads_tenant_id_idx").on(t.tenantId),
      phoneHashIdx: uniqueIndex("leads_phone_hash_idx").on(t.tenantId, t.phoneHash),
      statusIdx: index("leads_status_idx").on(t.tenantId, t.status),
      createdAtIdx: index("leads_created_at_idx").on(t.tenantId, t.createdAt),
      searchIdx: index("leads_search_idx").on(t.tenantId, t.phone, t.name, t.email),
      consentIdx: index("leads_consent_idx").on(t.tenantId, t.smsConsentAt)
    }));
    messages = mysqlTable("messages", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t) => ({
      tenantIdIdx: index("messages_tenant_id_idx").on(t.tenantId),
      leadIdIdx: index("messages_lead_id_idx").on(t.leadId),
      tenantLeadIdx: index("messages_tenant_lead_idx").on(t.tenantId, t.leadId),
      createdAtIdx: index("messages_created_at_idx").on(t.tenantId, t.createdAt),
      idempotencyKeyIdx: uniqueIndex("messages_idempotency_key_idx").on(t.tenantId, t.idempotencyKey)
    }));
    templates = mysqlTable("templates", {
      id: int("id").autoincrement().primaryKey(),
      tenantId: int("tenantId").notNull(),
      key: varchar("key", { length: 100 }).notNull(),
      name: varchar("name", { length: 255 }).notNull(),
      body: text("body").notNull(),
      tone: mysqlEnum("tone", ["friendly", "professional", "casual", "urgent"]).default("friendly").notNull(),
      variables: json("variables").$type(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      deletedAt: timestamp("deletedAt")
    });
    automations = mysqlTable("automations", {
      id: int("id").autoincrement().primaryKey(),
      tenantId: int("tenantId").notNull(),
      name: varchar("name", { length: 255 }).notNull(),
      key: varchar("key", { length: 100 }).notNull(),
      category: mysqlEnum("category", ["follow_up", "reactivation", "appointment", "welcome", "custom", "no_show", "cancellation", "loyalty"]).default("custom").notNull(),
      enabled: boolean("enabled").default(true).notNull(),
      triggerType: mysqlEnum("triggerType", ["new_lead", "inbound_message", "status_change", "time_delay", "appointment_reminder"]).default("new_lead").notNull(),
      triggerConfig: json("triggerConfig").$type(),
      conditions: json("conditions").$type(),
      actions: json("actions").$type(),
      runCount: int("runCount").default(0).notNull(),
      errorCount: int("errorCount").default(0).notNull(),
      lastRunAt: timestamp("lastRunAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      deletedAt: timestamp("deletedAt")
    });
    automationJobs = mysqlTable("automation_jobs", {
      id: int("id").autoincrement().primaryKey(),
      tenantId: int("tenantId").notNull(),
      automationId: int("automationId").notNull(),
      leadId: int("leadId"),
      eventType: varchar("eventType", { length: 100 }).notNull(),
      eventData: json("eventData").$type(),
      stepIndex: int("stepIndex").default(0).notNull(),
      nextRunAt: timestamp("nextRunAt").notNull(),
      status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled"]).default("pending").notNull(),
      attempts: int("attempts").default(0).notNull(),
      lastError: text("lastError"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    aiMessageLogs = mysqlTable("ai_message_logs", {
      id: int("id").autoincrement().primaryKey(),
      tenantId: int("tenantId").notNull(),
      leadId: int("leadId"),
      original: text("original").notNull(),
      rewritten: text("rewritten"),
      tone: varchar("tone", { length: 50 }).notNull(),
      success: boolean("success").default(true).notNull(),
      error: text("error"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    webhookLogs = mysqlTable("webhook_logs", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    apiKeys = mysqlTable("api_keys", {
      id: int("id").autoincrement().primaryKey(),
      tenantId: int("tenantId").notNull(),
      keyHash: varchar("keyHash", { length: 255 }).notNull(),
      keyPrefix: varchar("keyPrefix", { length: 10 }).notNull(),
      label: varchar("label", { length: 100 }),
      active: boolean("active").default(true).notNull(),
      lastUsedAt: timestamp("lastUsedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    systemErrorLogs = mysqlTable("system_error_logs", {
      id: int("id").autoincrement().primaryKey(),
      type: mysqlEnum("type", ["twilio", "ai", "automation", "billing", "webhook"]).notNull(),
      message: text("message").notNull(),
      detail: text("detail"),
      tenantId: int("tenantId"),
      resolved: boolean("resolved").default(false).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    adminAuditLogs = mysqlTable("admin_audit_logs", {
      id: int("id").autoincrement().primaryKey(),
      adminUserId: int("adminUserId").notNull(),
      adminEmail: varchar("adminEmail", { length: 320 }),
      action: varchar("action", { length: 120 }).notNull(),
      targetTenantId: int("targetTenantId"),
      targetUserId: int("targetUserId"),
      route: varchar("route", { length: 255 }),
      metadata: json("metadata").$type(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    smsRateLimits = mysqlTable("sms_rate_limits", {
      id: int("id").autoincrement().primaryKey(),
      tenantId: int("tenantId").notNull(),
      windowStart: timestamp("windowStart").notNull(),
      count: int("count").default(0).notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    llmCircuitBreakers = mysqlTable("llm_circuit_breakers", {
      id: int("id").autoincrement().primaryKey(),
      provider: varchar("provider", { length: 50 }).notNull(),
      model: varchar("model", { length: 100 }).notNull(),
      state: mysqlEnum("state", ["closed", "open", "half_open"]).default("closed").notNull(),
      consecutiveFailures: int("consecutiveFailures").default(0).notNull(),
      openedAt: timestamp("openedAt"),
      cooldownUntil: timestamp("cooldownUntil"),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    webhookReceiveDedupes = mysqlTable(
      "webhook_receive_dedupes",
      {
        id: int("id").autoincrement().primaryKey(),
        tenantId: int("tenantId").notNull(),
        dedupeKey: varchar("dedupeKey", { length: 64 }).notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull()
      },
      (t) => ({
        tenantDedupeUid: uniqueIndex("webhook_receive_dedupes_tenant_dedupe_uidx").on(t.tenantId, t.dedupeKey)
      })
    );
    authRateLimits = mysqlTable("auth_rate_limits", {
      id: int("id").autoincrement().primaryKey(),
      email: varchar("email", { length: 320 }).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t) => ({
      emailCreatedIdx: uniqueIndex("auth_rate_limits_email_created_idx").on(t.email, t.createdAt)
    }));
    referrals = mysqlTable("referrals", {
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
      payoutScheduledAt: timestamp("payout_scheduled_at"),
      // When payout should be processed
      payoutProcessedAt: timestamp("payout_processed_at"),
      // When payout was actually processed
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
      metadata: json("metadata")
    }, (table) => ({
      referrerIdIdx: index("idx_referrals_referrer_id").on(table.referrerId),
      referredUserIdIdx: index("idx_referrals_referred_user_id").on(table.referredUserId),
      statusIdx: index("idx_referrals_status").on(table.status),
      expiresAtIdx: index("idx_referrals_expires_at").on(table.expiresAt),
      payoutScheduledAtIdx: index("idx_referrals_payout_scheduled_at").on(table.payoutScheduledAt)
    }));
    referralPayouts = mysqlTable("referral_payouts", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      amount: int("amount").notNull(),
      currency: varchar("currency", { length: 3 }).default("USD").notNull(),
      status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
      method: mysqlEnum("method", ["paypal", "stripe", "bank_transfer"]).default("paypal").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      processedAt: timestamp("processedAt"),
      transactionId: varchar("transactionId", { length: 255 }),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    stripeSubscriptions = mysqlTable("stripe_subscriptions", {
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
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      userIdIdx: index("idx_subscriptions_user_id").on(table.userId),
      tenantIdIdx: index("idx_subscriptions_tenant_id").on(table.tenantId),
      customerIdIdx: index("idx_subscriptions_customer_id").on(table.customerId),
      statusIdx: index("idx_subscriptions_status").on(table.status)
    }));
  }
});

// server/db.ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
async function getDb() {
  if (_db) return _db;
  const dbUrl = process.env.DATABASE_URL || process.env.RAILWAY_URL || "mysql://root:example@db:3306/rebooked";
  _pool = mysql.createPool({
    uri: dbUrl,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_SIZE || "10", 10),
    queueLimit: 50,
    enableKeepAlive: true,
    keepAliveInitialDelay: 1e4,
    connectTimeout: 1e4,
    // Query timeouts for production safety
    timeout: parseInt(process.env.DB_QUERY_TIMEOUT || "30000", 10),
    // 30 seconds default
    acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || "60000", 10),
    // 60 seconds
    ssl: { rejectUnauthorized: false }
  });
  _db = drizzle(_pool, { schema: schema_exports, mode: "default" });
  return _db;
}
var _pool, _db;
var init_db = __esm({
  "server/db.ts"() {
    init_schema();
    _pool = null;
    _db = null;
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    ENV = {
      databaseUrl: process.env.DATABASE_URL ?? process.env.RAILWAY_URL ?? "mysql://root:example@db:3306/rebooked",
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
      referralProgramEnabled: process.env.REFERRAL_PROGRAM_ENABLED === "true"
    };
  }
});

// server/_core/appErrors.ts
function isAppError(error) {
  return error instanceof AppError;
}
var AppError;
var init_appErrors = __esm({
  "server/_core/appErrors.ts"() {
    AppError = class extends Error {
      code;
      statusCode;
      retryable;
      constructor(code, message, statusCode = 400, retryable = false) {
        super(message);
        this.name = "AppError";
        this.code = code;
        this.statusCode = statusCode;
        this.retryable = retryable;
      }
    };
  }
});

// server/_core/requestContext.ts
import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
function runWithCorrelationId(correlationId, fn) {
  return storage.run({ correlationId: correlationId || randomUUID() }, fn);
}
function getCorrelationId() {
  return storage.getStore()?.correlationId;
}
var storage;
var init_requestContext = __esm({
  "server/_core/requestContext.ts"() {
    storage = new AsyncLocalStorage();
  }
});

// server/_core/logger.ts
function emit(level, message, meta) {
  const entry = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    message,
    correlationId: getCorrelationId(),
    ...meta
  };
  if (isProd) {
    const out = level === "error" || level === "warn" ? process.stderr : process.stdout;
    out.write(JSON.stringify(entry) + "\n");
  } else {
    const colors = {
      debug: "\x1B[90m",
      info: "\x1B[36m",
      warn: "\x1B[33m",
      error: "\x1B[31m"
    };
    const reset = "\x1B[0m";
    const prefix = `${colors[level]}[${level.toUpperCase()}]${reset}`;
    const metaStr = meta ? " " + JSON.stringify(meta) : "";
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`${prefix} ${message}${metaStr}`);
  }
}
var isProd, logger;
var init_logger = __esm({
  "server/_core/logger.ts"() {
    init_requestContext();
    isProd = process.env.NODE_ENV === "production";
    logger = {
      debug: (msg, meta) => emit("debug", msg, meta),
      info: (msg, meta) => emit("info", msg, meta),
      warn: (msg, meta) => emit("warn", msg, meta),
      error: (msg, meta) => emit("error", msg, meta)
    };
  }
});

// server/services/rateLimit.service.ts
import { and, eq, gte, ne, sql as sql2 } from "drizzle-orm";
async function assertSmsHourlyDailyLimits(db, tenantId) {
  const hourlyCap = parseInt(process.env.SMS_HOURLY_CAP || "0", 10);
  const dailyCap = parseInt(process.env.SMS_DAILY_CAP_PER_TENANT || "0", 10);
  if (hourlyCap <= 0 && dailyCap <= 0) return;
  const sinceHour = new Date(Date.now() - 60 * 60 * 1e3);
  const sinceDay = /* @__PURE__ */ new Date();
  sinceDay.setHours(0, 0, 0, 0);
  if (hourlyCap > 0) {
    const [{ c }] = await db.select({ c: sql2`count(*)` }).from(messages).where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.direction, "outbound"),
        ne(messages.status, "failed"),
        gte(messages.createdAt, sinceHour)
      )
    );
    if (Number(c) >= hourlyCap) {
      throw new AppError("RATE_LIMITED", `Hourly SMS limit exceeded (${hourlyCap}/hour)`, 429);
    }
  }
  if (dailyCap > 0) {
    const [{ c }] = await db.select({ c: sql2`count(*)` }).from(messages).where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.direction, "outbound"),
        ne(messages.status, "failed"),
        gte(messages.createdAt, sinceDay)
      )
    );
    if (Number(c) >= dailyCap) {
      throw new AppError("RATE_LIMITED", `Daily SMS limit exceeded (${dailyCap}/day)`, 429);
    }
  }
}
async function assertSmsRateLimitAvailable(db, tenantId) {
  const windowStart = /* @__PURE__ */ new Date();
  windowStart.setSeconds(0, 0);
  const bucket = windowStart;
  const maxPerMinute = parseInt(process.env.SMS_RATE_LIMIT || "60", 10);
  const [row] = await db.select().from(smsRateLimits).where(and(eq(smsRateLimits.tenantId, tenantId), eq(smsRateLimits.windowStart, bucket))).limit(1);
  if (row && row.count >= maxPerMinute) {
    throw new AppError("RATE_LIMITED", `Rate limit exceeded (${maxPerMinute} SMS/min)`, 429);
  }
  if (row) {
    await db.update(smsRateLimits).set({ count: row.count + 1, updatedAt: /* @__PURE__ */ new Date() }).where(eq(smsRateLimits.id, row.id));
  } else {
    await db.insert(smsRateLimits).values({
      tenantId,
      windowStart: bucket,
      count: 1,
      updatedAt: /* @__PURE__ */ new Date()
    });
  }
}
var init_rateLimit_service = __esm({
  "server/services/rateLimit.service.ts"() {
    init_schema();
    init_appErrors();
  }
});

// server/services/usage.service.ts
import { and as and2, desc, eq as eq2, sql as sql3 } from "drizzle-orm";
async function getTenantUsageState(db, tenantId) {
  const [usageRow] = await db.select().from(usage).where(eq2(usage.tenantId, tenantId)).orderBy(desc(usage.periodStart)).limit(1);
  const [subscriptionRow] = await db.select({ sub: subscriptions, plan: plans }).from(subscriptions).innerJoin(plans, eq2(subscriptions.planId, plans.id)).where(and2(eq2(subscriptions.tenantId, tenantId), eq2(subscriptions.status, "active"))).orderBy(desc(subscriptions.createdAt)).limit(1);
  return {
    usage: usageRow,
    subscription: subscriptionRow?.sub,
    plan: subscriptionRow?.plan
  };
}
async function assertUsageCapAvailable(db, tenantId) {
  const state = await getTenantUsageState(db, tenantId);
  const cap = state.plan?.maxMessages ?? 0;
  const used = state.usage?.messagesSent ?? 0;
  if (cap > 0 && used >= cap) {
    throw new AppError("USAGE_CAP_EXCEEDED", "Monthly SMS usage cap exceeded", 429);
  }
  return { cap, used };
}
async function incrementOutboundUsageIfAllowed(db, tenantId) {
  const state = await getTenantUsageState(db, tenantId);
  const cap = state.plan?.maxMessages ?? 0;
  const usageRow = state.usage;
  if (!usageRow) return false;
  if (cap === 0) {
    await db.update(usage).set({ messagesSent: sql3`${usage.messagesSent} + 1`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(usage.id, usageRow.id));
    return true;
  }
  const result = await db.execute(sql3`
    UPDATE usage u
    INNER JOIN subscriptions s ON s.tenantId = u.tenantId AND s.status = 'active'
    INNER JOIN plans p ON p.id = s.planId
    SET u.messagesSent = u.messagesSent + 1, u.updatedAt = NOW()
    WHERE u.id = ${usageRow.id} AND u.tenantId = ${tenantId} AND u.messagesSent < p.maxMessages
  `);
  const header = Array.isArray(result) ? result[0] : result;
  return (header?.affectedRows ?? 0) > 0;
}
var init_usage_service = __esm({
  "server/services/usage.service.ts"() {
    init_schema();
    init_appErrors();
  }
});

// server/_core/sms.ts
async function fetchSmsProvider(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SMS_HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text2 = await response.text();
    let data = {};
    try {
      data = text2 ? JSON.parse(text2) : {};
    } catch {
      data = { raw: text2 };
    }
    return { ok: response.ok, status: response.status, data, text: text2 };
  } catch (error) {
    const msg = error instanceof Error && error.name === "AbortError" ? `SMS request timed out after ${SMS_HTTP_TIMEOUT_MS}ms` : String(error);
    logger.warn("SMS provider fetch failed", { url, error: msg });
    return { ok: false, status: 0, data: {}, text: msg };
  } finally {
    clearTimeout(timer);
  }
}
async function guardOutboundSend(tenantId) {
  if (!tenantId) return null;
  try {
    const db = await getDb();
    if (db) {
      await assertSmsRateLimitAvailable(db, tenantId);
      await assertSmsHourlyDailyLimits(db, tenantId);
      await assertUsageCapAvailable(db, tenantId);
    }
    return null;
  } catch (error) {
    if (isAppError(error)) {
      logger.warn("SMS blocked before provider call", { tenantId, code: error.code, message: error.message });
      return {
        success: false,
        error: error.message,
        errorCode: error.code
      };
    }
    throw error;
  }
}
async function sendViaTelnyx(to, body, from) {
  const { ok, data, text: text2 } = await fetchSmsProvider("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.telnyxApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to, text: body })
  });
  const d = data;
  if (!ok) {
    const message = d?.errors?.[0]?.detail || d?.message || text2 || "Telnyx request failed";
    logger.warn("Telnyx send failed", { to, error: message });
    return { success: false, error: message, provider: "telnyx", errorCode: "TELNYX_ERROR" };
  }
  return { success: true, sid: d?.data?.id, provider: "telnyx" };
}
async function sendViaTwilio(to, body, from) {
  const auth = Buffer.from(`${ENV.twilioAccountSid}:${ENV.twilioAuthToken}`).toString("base64");
  const { ok, data, text: text2 } = await fetchSmsProvider(
    `https://api.twilio.com/2010-04-01/Accounts/${ENV.twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }).toString()
    }
  );
  const d = data;
  if (!ok) {
    const message = d?.message || text2 || "Twilio request failed";
    logger.warn("Twilio send failed", { to, error: message });
    return { success: false, error: message, provider: "twilio", errorCode: "TWILIO_ERROR" };
  }
  return { success: true, sid: d?.sid, provider: "twilio" };
}
async function sendSMS(to, body, from, tenantId) {
  const guardResult = await guardOutboundSend(tenantId);
  if (guardResult) return guardResult;
  if (ENV.telnyxApiKey) {
    const fromNumber = from || ENV.telnyxFromNumber;
    if (!fromNumber) {
      logger.warn("TELNYX_FROM_NUMBER not set");
    } else {
      return sendViaTelnyx(to, body, fromNumber);
    }
  }
  if (ENV.twilioAccountSid && ENV.twilioAuthToken) {
    const fromNumber = from || ENV.twilioFromNumber;
    if (!fromNumber) {
      logger.warn("TWILIO_FROM_NUMBER not set");
    } else {
      return sendViaTwilio(to, body, fromNumber);
    }
  }
  logger.warn("No SMS provider configured", { to });
  return { success: true, sid: `dev_${Date.now()}`, provider: "dev" };
}
function resolveTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val != null ? String(val) : "";
  });
}
var SMS_HTTP_TIMEOUT_MS;
var init_sms = __esm({
  "server/_core/sms.ts"() {
    init_env();
    init_appErrors();
    init_logger();
    init_db();
    init_rateLimit_service();
    init_usage_service();
    SMS_HTTP_TIMEOUT_MS = parseInt(process.env.SMS_HTTP_TIMEOUT_MS || "30000", 10);
  }
});

// server/services/query.service.ts
async function withQueryTimeout(label, work, timeoutMs = parseInt(process.env.DB_QUERY_TIMEOUT_MS || "5000", 10)) {
  let timer;
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } catch (error) {
    logger.warn("Query timeout or failure", { label, error: String(error) });
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
var init_query_service = __esm({
  "server/services/query.service.ts"() {
    init_logger();
  }
});

// server/services/lead-search-optimization.service.ts
var lead_search_optimization_service_exports = {};
__export(lead_search_optimization_service_exports, {
  clearSearchCache: () => clearSearchCache2,
  getLeadByIdOptimized: () => getLeadByIdOptimized,
  getSearchMemoryStats: () => getSearchMemoryStats,
  searchLeads: () => searchLeads
});
import { eq as eq4, and as and4, desc as desc2, sql as sql4, ilike, or } from "drizzle-orm";
async function searchLeads(db, tenantId, options = {}) {
  const cacheKey = `leads_${tenantId}_${JSON.stringify(options)}`;
  const now = Date.now();
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL) {
      memoryUsage.cacheHits++;
      return cached.data;
    }
  }
  memoryUsage.cacheMisses++;
  try {
    const result = await withQueryTimeout(
      db.select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        email: leads.email,
        status: leads.status,
        appointmentAt: leads.appointmentAt,
        estimatedRevenue: leads.estimatedRevenue,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        messageCount: sql4`(SELECT COUNT(*) FROM messages WHERE messages.leadId = leads.id)`.as("messageCount")
      }).from(leads).where(
        and4(
          eq4(leads.tenantId, tenantId),
          options.status ? eq4(leads.status, options.status) : void 0,
          options.search ? or(
            ilike(leads.name, `%${options.search}%`),
            ilike(leads.phone, `%${options.search}%`),
            ilike(leads.email, `%${options.search}%`)
          ) : void 0
        )
      ).orderBy(desc2(leads.createdAt)).limit(options.limit || 20).offset(((options.page || 1) - 1) * (options.limit || 20)),
      1e4,
      // 10 second timeout
      "Lead search query timeout"
    );
    searchCache.set(cacheKey, { data: result, timestamp: now });
    memoryUsage.queries++;
    if (now - memoryUsage.lastCleanup > 6e4) {
      cleanupCache();
      memoryUsage.lastCleanup = now;
    }
    return result;
  } catch (error) {
    console.error("Lead search error:", error);
    throw new Error(`Search failed: ${error.message}`);
  }
}
async function getLeadByIdOptimized(db, tenantId, leadId) {
  const cacheKey = `lead_${tenantId}_${leadId}`;
  const now = Date.now();
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL) {
      memoryUsage.cacheHits++;
      return cached.data;
    }
  }
  memoryUsage.cacheMisses++;
  try {
    const result = await withQueryTimeout(
      db.select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        email: leads.email,
        status: leads.status,
        appointmentAt: leads.appointmentAt,
        estimatedRevenue: leads.estimatedRevenue,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt
      }).from(leads).where(
        and4(
          eq4(leads.tenantId, tenantId),
          eq4(leads.id, leadId)
        )
      ).limit(1),
      5e3,
      // 5 second timeout
      "Get lead by ID timeout"
    );
    const lead = result[0] || null;
    if (lead) {
      searchCache.set(cacheKey, { data: lead, timestamp: now });
    }
    memoryUsage.queries++;
    return lead;
  } catch (error) {
    console.error("Get lead by ID error:", error);
    throw new Error(`Failed to get lead: ${error.message}`);
  }
}
function getSearchMemoryStats() {
  return {
    ...memoryUsage,
    cacheSize: searchCache.size,
    cacheHitRate: memoryUsage.cacheHits / (memoryUsage.cacheHits + memoryUsage.cacheMisses) * 100
  };
}
function cleanupCache() {
  const now = Date.now();
  const keysToDelete = [];
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => searchCache.delete(key));
  if (keysToDelete.length > 0) {
    console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
  }
}
function clearSearchCache2() {
  searchCache.clear();
  memoryUsage = {
    queries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastCleanup: Date.now()
  };
  console.log("Lead search cache cleared");
}
var searchCache, CACHE_TTL, memoryUsage;
var init_lead_search_optimization_service = __esm({
  "server/services/lead-search-optimization.service.ts"() {
    init_schema();
    init_query_service();
    searchCache = /* @__PURE__ */ new Map();
    CACHE_TTL = 5 * 60 * 1e3;
    memoryUsage = {
      queries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastCleanup: Date.now()
    };
  }
});

// server/_core/email.ts
var email_exports = {};
__export(email_exports, {
  sendEmail: () => sendEmail
});
import nodemailer from "nodemailer";
function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER);
}
async function sendEmail(options) {
  const fromAddress = ENV.emailFromAddress || "hello@rebooked.com";
  if (smtpConfigured()) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || ""
        }
      });
      await transporter.sendMail({
        from: `"Rebooked" <${fromAddress}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html ?? options.text
      });
      console.log(`[Email] SMTP sent to ${options.to} subject=${options.subject}`);
      return { success: true };
    } catch (error) {
      console.error("[Email] SMTP failed:", error);
      return { success: false, error: String(error) };
    }
  }
  const sendGridKey = ENV.sendGridApiKey;
  if (!sendGridKey) {
    console.warn(`[Email] No SMTP or SendGrid configured, skipping email to ${options.to}.`);
    return { success: false, error: "Email not configured (set SMTP_* or SENDGRID_API_KEY)" };
  }
  try {
    const body = {
      personalizations: [{ to: [{ email: options.to }] }],
      from: { email: fromAddress, name: "Rebooked" },
      subject: options.subject,
      content: [
        { type: "text/plain", value: options.text },
        { type: "text/html", value: options.html || options.text }
      ]
    };
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendGridKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Email] SendGrid returned", response.status, errorBody);
      return { success: false, error: `SendGrid ${response.status}` };
    }
    console.log(`[Email] Sent to ${options.to} subject=${options.subject}`);
    return { success: true };
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return { success: false, error: String(error) };
  }
}
var init_email = __esm({
  "server/_core/email.ts"() {
    init_env();
  }
});

// server/worker.ts
init_db();
init_schema();
init_sms();
init_logger();
import "dotenv/config";
import { and as and9, desc as desc7, eq as eq10, gt, isNotNull, isNull as isNull3, lt, sql as sql9 } from "drizzle-orm";

// server/_core/sentry.ts
var _initialized = false;
async function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0.1
    });
    _initialized = true;
    console.log("[Sentry] Initialized");
  } catch {
    console.warn("[Sentry] @sentry/node not installed \u2014 skipping error tracking. Run: pnpm add @sentry/node");
  }
}
async function captureException(err, context) {
  if (!_initialized) return;
  try {
    const Sentry = await import("@sentry/node");
    Sentry.withScope((scope) => {
      if (context) scope.setExtras(context);
      Sentry.captureException(err);
    });
  } catch {
  }
}

// server/services/lead.service.ts
init_schema();
import { eq as eq5, and as and5, desc as desc3 } from "drizzle-orm";

// server/_core/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
var ALGO = "aes-256-gcm";
var KEY_HEX = process.env.ENCRYPTION_KEY ?? "";
function getKey() {
  if (!KEY_HEX || KEY_HEX.length !== 64) return null;
  return Buffer.from(KEY_HEX, "hex");
}
function encrypt(plaintext) {
  const key = getKey();
  if (!key) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64")
  ].join(":");
}
function decrypt(value) {
  const key = getKey();
  if (!key) return value;
  const parts = value.split(":");
  if (parts.length !== 3) return value;
  const [ivB64, authTagB64, ciphertextB64] = parts;
  try {
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  } catch {
    return value;
  }
}
function encryptIfNeeded(value) {
  if (!value) return value ?? null;
  if (value.split(":").length === 3) return value;
  return encrypt(value);
}

// shared/phone.ts
import { parsePhoneNumberFromString } from "libphonenumber-js";
function asCountry(code) {
  const c = code.trim().toUpperCase();
  return c.length === 2 ? c : "US";
}
function normalizePhoneE164(input, defaultRegion = "US") {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const region = asCountry(defaultRegion);
    const parsed = trimmed.startsWith("+") ? parsePhoneNumberFromString(trimmed) : parsePhoneNumberFromString(trimmed, region);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.format("E.164");
  } catch {
    return null;
  }
}

// server/_core/phone.ts
init_appErrors();
var DEFAULT_REGION = (process.env.PHONE_DEFAULT_REGION || "US").trim() || "US";

// server/services/lead.service.ts
init_logger();
init_usage_service();

// server/services/tcpaCompliance.service.ts
init_schema();
init_logger();
import { eq as eq3, and as and3 } from "drizzle-orm";

// server/_core/query-timeout.service.ts
var QueryCircuitBreaker = class {
  constructor(failureThreshold = 5, timeoutMs = 6e4, successThreshold = 3) {
    this.failureThreshold = failureThreshold;
    this.timeoutMs = timeoutMs;
    this.successThreshold = successThreshold;
  }
  failures = 0;
  lastFailureTime = 0;
  state = "closed";
  async execute(query) {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = "half-open";
        console.log("\u{1F504} Circuit breaker moving to half-open state");
      } else {
        throw new Error("Circuit breaker is open");
      }
    }
    try {
      const result = await query();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  onSuccess() {
    this.failures = 0;
    if (this.state === "half-open") {
      this.state = "closed";
      console.log("\u2705 Circuit breaker closed after successful request");
    }
  }
  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = "open";
      console.log("\u{1F6AB} Circuit breaker opened due to failures");
    }
  }
  getState() {
    return this.state;
  }
  reset() {
    this.failures = 0;
    this.state = "closed";
    console.log("\u{1F504} Circuit breaker reset");
  }
};
var globalCircuitBreaker = new QueryCircuitBreaker();
var QueryPerformanceMonitor = class {
  static metrics = {
    totalQueries: 0,
    slowQueries: 0,
    timeouts: 0,
    averageLatency: 0,
    maxLatency: 0
  };
  static async trackQuery(query, queryName, slowThresholdMs = 1e3) {
    const startTime = Date.now();
    try {
      this.metrics.totalQueries++;
      const result = await query();
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, false);
      if (latency > slowThresholdMs) {
        this.metrics.slowQueries++;
        console.warn(`\u{1F40C} Slow query detected: ${queryName} took ${latency}ms`);
      }
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, true);
      if (latency > 5e3) {
        this.metrics.timeouts++;
        console.error(`\u23F0 Query timeout: ${queryName} after ${latency}ms`);
      }
      throw error;
    }
  }
  static updateMetrics(latency, isError) {
    this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency);
    this.metrics.averageLatency = (this.metrics.averageLatency * (this.metrics.totalQueries - 1) + latency) / this.metrics.totalQueries;
  }
  static getMetrics() {
    return { ...this.metrics };
  }
  static resetMetrics() {
    this.metrics = {
      totalQueries: 0,
      slowQueries: 0,
      timeouts: 0,
      averageLatency: 0,
      maxLatency: 0
    };
  }
};

// server/services/lead.service.ts
init_lead_search_optimization_service();

// server/_core/message-encryption.ts
import crypto from "crypto";
var MessageEncryption = class {
  algorithm = "aes-256-gcm";
  keyLength = 32;
  ivLength = 16;
  tagLength = 16;
  key;
  constructor() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("ENCRYPTION_KEY environment variable is required");
    }
    this.key = crypto.scryptSync(encryptionKey, "salt", this.keyLength);
  }
  /**
   * Encrypt message body
   */
  encrypt(message) {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, this.key);
      cipher.setAAD(Buffer.from("message-body", "utf8"));
      let encrypted = cipher.update(message, "utf8", "hex");
      encrypted += cipher.final("hex");
      const tag = cipher.getAuthTag();
      return {
        encrypted,
        iv: iv.toString("hex"),
        tag: tag.toString("hex")
      };
    } catch (error) {
      console.error("Encryption error:", error);
      throw new Error(`Failed to encrypt message: ${error.message}`);
    }
  }
  /**
   * Decrypt message body
   */
  decrypt(encryptedData) {
    try {
      const decipher = crypto.createDecipher(this.algorithm, this.key);
      decipher.setAAD(Buffer.from("message-body", "utf8"));
      decipher.setAuthTag(Buffer.from(encryptedData.tag, "hex"));
      decipher.setIV(Buffer.from(encryptedData.iv, "hex"));
      let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return {
        decrypted,
        success: true
      };
    } catch (error) {
      console.error("Decryption error:", error);
      return {
        decrypted: "",
        success: false
      };
    }
  }
  /**
   * Encrypt phone number (for storage)
   */
  encryptPhoneNumber(phone) {
    try {
      const normalizedPhone = this.normalizePhone(phone);
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher("aes-256-cbc", this.key);
      let encrypted = cipher.update(normalizedPhone, "utf8", "hex");
      encrypted += cipher.final("hex");
      return iv.toString("hex") + ":" + encrypted;
    } catch (error) {
      console.error("Phone encryption error:", error);
      throw new Error(`Failed to encrypt phone: ${error.message}`);
    }
  }
  /**
   * Decrypt phone number
   */
  decryptPhoneNumber(encryptedPhone) {
    try {
      const parts = encryptedPhone.split(":");
      if (parts.length !== 2) {
        throw new Error("Invalid encrypted phone format");
      }
      const iv = Buffer.from(parts[0], "hex");
      const encrypted = parts[1];
      const decipher = crypto.createDecipher("aes-256-cbc", this.key);
      decipher.setIV(iv);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (error) {
      console.error("Phone decryption error:", error);
      throw new Error(`Failed to decrypt phone: ${error.message}`);
    }
  }
  /**
   * Hash sensitive data for comparison
   */
  hashSensitiveData(data) {
    return crypto.createHash("sha256").update(data + process.env.HASH_SALT || "default-salt").digest("hex");
  }
  /**
   * Generate secure random token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString("hex");
  }
  /**
   * Verify data integrity
   */
  verifyIntegrity(data, hash) {
    const computedHash = this.hashSensitiveData(data);
    return computedHash === hash;
  }
  /**
   * Normalize phone number format
   */
  normalizePhone(phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length > 10 && !digits.startsWith("+")) {
      return `+${digits}`;
    }
    return digits.startsWith("+") ? digits : `+${digits}`;
  }
  /**
   * Check if encryption key is properly configured
   */
  isConfigured() {
    return !!process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 16;
  }
  /**
   * Rotate encryption key (for security maintenance)
   */
  rotateKey(newKey) {
    process.env.ENCRYPTION_KEY = newKey;
    const newDerivedKey = crypto.scryptSync(newKey, "salt", this.keyLength);
    this.key = newDerivedKey;
    console.log("\u{1F511} Encryption key rotated successfully");
  }
};
var messageEncryption = new MessageEncryption();
var encryptMessage = (message) => messageEncryption.encrypt(message);

// server/services/lead.service.ts
function presentLead(lead) {
  if (!lead) return lead;
  return {
    ...lead,
    phone: lead.phone ? decrypt(lead.phone) : lead.phone,
    name: lead.name ? decrypt(lead.name) : lead.name,
    email: lead.email ? decrypt(lead.email) : lead.email
  };
}
async function getLeadById(db, tenantId, leadId) {
  const lead = await QueryPerformanceMonitor.trackQuery(
    () => getLeadByIdOptimized(db, tenantId, leadId),
    "getLeadById",
    500
    // 500ms slow threshold
  );
  return presentLead(lead);
}
async function createMessage(db, data) {
  if (!messageEncryption.isConfigured()) {
    logger.warn("Message encryption not configured, storing plain text");
  }
  let encryptedBody = data.body;
  let encryptedFromNumber = data.fromNumber;
  let encryptedToNumber = data.toNumber;
  if (messageEncryption.isConfigured()) {
    try {
      const encryptedMsg = encryptMessage(data.body);
      encryptedBody = `${encryptedMsg.encrypted}:${encryptedMsg.iv}:${encryptedMsg.tag}`;
      if (data.fromNumber) {
        encryptedFromNumber = messageEncryption.encryptPhoneNumber(data.fromNumber);
      }
      if (data.toNumber) {
        encryptedToNumber = messageEncryption.encryptPhoneNumber(data.toNumber);
      }
    } catch (error) {
      logger.error("Message encryption failed:", error);
      encryptedBody = encryptIfNeeded(data.body);
      encryptedFromNumber = data.fromNumber ? encryptIfNeeded(data.fromNumber) : void 0;
      encryptedToNumber = data.toNumber ? encryptIfNeeded(data.toNumber) : void 0;
    }
  }
  return db.transaction(async (tx) => {
    const result = await tx.insert(messages).values({
      ...data,
      body: encryptedBody,
      fromNumber: encryptedFromNumber,
      toNumber: encryptedToNumber,
      status: data.status || "sent"
    });
    await tx.update(leads).set({ lastMessageAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(and5(eq5(leads.id, data.leadId), eq5(leads.tenantId, data.tenantId)));
    if (data.direction === "outbound" && data.status !== "failed") {
      const incremented = await incrementOutboundUsageIfAllowed(tx, data.tenantId);
      if (!incremented) {
        logger.error("Usage counter could not be incremented \u2014 cap race, missing usage row, or plan mismatch", {
          tenantId: data.tenantId,
          leadId: data.leadId
        });
      }
    }
    return result;
  });
}

// server/services/user.service.ts
init_schema();
import { eq as eq6, desc as desc4, sql as sql6 } from "drizzle-orm";
async function getPrimaryUserEmailByTenant(db, tenantId) {
  const result = await db.select().from(users).where(eq6(users.tenantId, tenantId)).orderBy(users.id).limit(1);
  return result[0]?.email;
}

// server/worker.ts
import { writeFileSync } from "fs";
import { randomUUID as randomUUID2 } from "crypto";
init_requestContext();

// server/services/automationRunner.ts
init_schema();
import { sql as sql8 } from "drizzle-orm";
init_sms();

// server/services/automationJob.service.ts
init_schema();
import { and as and6, asc, eq as eq7, lte } from "drizzle-orm";
async function enqueueAutomationJob(db, input) {
  await db.insert(automationJobs).values({
    tenantId: input.tenantId,
    automationId: input.automationId,
    leadId: input.leadId,
    eventType: input.eventType,
    eventData: input.eventData,
    stepIndex: input.stepIndex,
    nextRunAt: input.nextRunAt
  });
}
async function claimDueAutomationJobs(db, limit = 50) {
  const rows = await db.select().from(automationJobs).where(and6(eq7(automationJobs.status, "pending"), lte(automationJobs.nextRunAt, /* @__PURE__ */ new Date()))).orderBy(asc(automationJobs.nextRunAt)).limit(limit);
  const claimed = [];
  for (const row of rows) {
    await db.update(automationJobs).set({ status: "running", attempts: row.attempts + 1, updatedAt: /* @__PURE__ */ new Date() }).where(and6(eq7(automationJobs.id, row.id), eq7(automationJobs.status, "pending")));
    claimed.push({ ...row, status: "running", attempts: row.attempts + 1 });
  }
  return claimed;
}
async function completeAutomationJob(db, jobId) {
  await db.update(automationJobs).set({ status: "completed", updatedAt: /* @__PURE__ */ new Date() }).where(eq7(automationJobs.id, jobId));
}
async function failAutomationJob(db, jobId, lastError) {
  await db.update(automationJobs).set({ status: "failed", lastError, updatedAt: /* @__PURE__ */ new Date() }).where(eq7(automationJobs.id, jobId));
}

// server/services/automation.service.ts
init_schema();
import { eq as eq8, and as and7, desc as desc5, isNull } from "drizzle-orm";
async function getAutomationById(db, tenantId, automationId) {
  const result = await db.select().from(automations).where(and7(eq8(automations.id, automationId), eq8(automations.tenantId, tenantId), isNull(automations.deletedAt))).limit(1);
  return result[0];
}
async function updateAutomation(db, tenantId, automationId, data) {
  await db.update(automations).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(and7(eq8(automations.id, automationId), eq8(automations.tenantId, tenantId), isNull(automations.deletedAt)));
}

// server/services/tenant.service.ts
init_schema();
import { eq as eq9, desc as desc6, and as and8, sql as sql7, isNull as isNull2 } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
async function getSubscriptionByTenantId(db, tenantId) {
  const result = await db.select().from(subscriptions).where(eq9(subscriptions.tenantId, tenantId)).orderBy(desc6(subscriptions.createdAt)).limit(1);
  return result[0];
}
function isSubscriptionEntitled(subscription) {
  if (!subscription) return false;
  const now = Date.now();
  if (subscription.status === "active") return true;
  if (subscription.status === "trialing") {
    return subscription.trialEndsAt ? new Date(subscription.trialEndsAt).getTime() > now : true;
  }
  if (subscription.status === "past_due") {
    return subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).getTime() > now : false;
  }
  return false;
}
async function tenantHasAutomationAccess(db, tenantId) {
  const subscription = await getSubscriptionByTenantId(db, tenantId);
  return isSubscriptionEntitled(subscription);
}

// server/services/automationRunner.ts
var MAX_RETRY = 3;
async function sendWithRetry(to, body, fromNumber, tenantId, attempt = 1) {
  const res = await sendSMS(to, body, fromNumber, tenantId);
  if (res.success) return res;
  if (attempt < MAX_RETRY) {
    return sendWithRetry(to, body, fromNumber, tenantId, attempt + 1);
  }
  return res;
}
async function executeStep(db, step, event, tenantId, leadId) {
  switch (step.type) {
    case "sms":
    case "send_message": {
      let toPhone = event.data?.phone ?? event.data?.leadPhone;
      if (!toPhone && leadId) {
        const lead = await getLeadById(db, tenantId, leadId);
        toPhone = lead?.phone;
      }
      if (!toPhone) throw new Error("No target phone number for sms step");
      const normalized = normalizePhoneE164(String(toPhone));
      if (!normalized) throw new Error("Invalid phone number for SMS automation step");
      const body = resolveTemplate(String(step.message || step.body || ""), { ...event.data });
      const res = await sendWithRetry(normalized, body, void 0, tenantId);
      if (leadId) {
        await createMessage(db, {
          tenantId,
          leadId,
          direction: "outbound",
          body,
          status: res.success ? "sent" : "failed",
          twilioSid: res.sid,
          provider: res.provider,
          providerError: [res.errorCode, res.error].filter(Boolean).join(": ") || void 0,
          retryCount: res.retryCount || 0,
          deliveredAt: res.success ? /* @__PURE__ */ new Date() : void 0,
          failedAt: res.success ? void 0 : /* @__PURE__ */ new Date()
        });
      }
      return;
    }
    case "webhook": {
      if (!step.url) throw new Error("No webhook URL provided");
      const response = await fetch(step.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, step })
      });
      if (!response.ok) throw new Error(`Webhook call failed ${response.status}`);
      return;
    }
    default:
      return;
  }
}
async function continueAutomation(db, automation, event, startStepIndex, leadId) {
  const steps = Array.isArray(automation.actions) ? automation.actions : [];
  for (let index2 = startStepIndex; index2 < steps.length; index2 += 1) {
    const step = steps[index2];
    if (step?.type === "delay") {
      const seconds = Number(step.value ?? 0);
      if (seconds > 0) {
        await enqueueAutomationJob(db, {
          tenantId: event.tenantId,
          automationId: automation.id,
          leadId,
          eventType: event.type,
          eventData: event.data,
          stepIndex: index2 + 1,
          nextRunAt: new Date(Date.now() + seconds * 1e3)
        });
        return;
      }
      continue;
    }
    await new Promise((resolve, reject) => {
      setImmediate(async () => {
        try {
          await executeStep(db, step, event, event.tenantId, leadId);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  await updateAutomation(db, event.tenantId, automation.id, {
    runCount: sql8`${automations.runCount} + 1`,
    lastRunAt: /* @__PURE__ */ new Date()
  });
}
async function processQueuedAutomationJobs(db, limit = 50) {
  const jobs = await claimDueAutomationJobs(db, limit);
  for (const job of jobs) {
    try {
      const entitled = await tenantHasAutomationAccess(db, job.tenantId);
      if (!entitled) {
        await failAutomationJob(db, job.id, "Tenant subscription is no longer entitled to run automations");
        continue;
      }
      const automation = await getAutomationById(db, job.tenantId, job.automationId);
      if (!automation || !automation.enabled) {
        await failAutomationJob(db, job.id, "Automation no longer available");
        continue;
      }
      const event = {
        type: job.eventType,
        tenantId: job.tenantId,
        data: job.eventData ?? {},
        timestamp: /* @__PURE__ */ new Date()
      };
      await continueAutomation(db, automation, event, job.stepIndex, job.leadId ?? void 0);
      await completeAutomationJob(db, job.id);
    } catch (error) {
      await failAutomationJob(db, job.id, error instanceof Error ? error.message : String(error));
    }
  }
}

// server/services/email.service.ts
init_email();

// server/_core/pop3.ts
init_logger();
import { simpleParser } from "mailparser";
async function connectPOP3(config) {
  return new Promise((resolve, reject) => {
    const client = new POP3Client(config.port, config.host, {
      tls: config.tls
    });
    client.on("connect", () => {
      logger.info("POP3 connected", { host: config.host, port: config.port });
      client.login(config.user, config.password, (err) => {
        if (err) {
          logger.error("POP3 login failed", { error: err.message, user: config.user });
          reject(err);
        } else {
          logger.info("POP3 login successful", { user: config.user });
          resolve(client);
        }
      });
    });
    client.on("error", (err) => {
      logger.error("POP3 connection error", { error: err.message });
      reject(err);
    });
    client.connect();
  });
}
async function retrieveEmails(client) {
  return new Promise((resolve, reject) => {
    client.stat((err, stats) => {
      if (err) {
        logger.error("POP3 stat failed", { error: err.message });
        reject(err);
        return;
      }
      const messageCount = stats.count;
      logger.info("POP3 messages found", { count: messageCount });
      if (messageCount === 0) {
        resolve([]);
        return;
      }
      const messages3 = [];
      let processedCount = 0;
      for (let i = 1; i <= messageCount; i++) {
        client.retr(i, (err2, data) => {
          if (err2) {
            logger.error("POP3 retr failed", { error: err2.message, messageNumber: i });
            processedCount++;
            if (processedCount === messageCount) {
              resolve(messages3);
            }
            return;
          }
          simpleParser(Buffer.from(data), (parseErr, parsed) => {
            if (parseErr) {
              logger.error("Email parse failed", { error: parseErr.message, messageNumber: i });
            } else {
              const message = {
                from: parsed.from?.text || "",
                to: parsed.to?.text || "",
                subject: parsed.subject || "",
                text: parsed.text || "",
                html: parsed.html || void 0,
                date: parsed.date || /* @__PURE__ */ new Date(),
                messageId: parsed.messageId || "",
                headers: parsed.headers
              };
              messages3.push(message);
            }
            processedCount++;
            if (processedCount === messageCount) {
              resolve(messages3);
            }
          });
        });
      }
    });
  });
}
async function deleteEmails(client, messageCount) {
  return new Promise((resolve, reject) => {
    let deletedCount = 0;
    for (let i = 1; i <= messageCount; i++) {
      client.dele(i, (err) => {
        if (err) {
          logger.error("POP3 delete failed", { error: err.message, messageNumber: i });
        }
        deletedCount++;
        if (deletedCount === messageCount) {
          client.quit(() => {
            logger.info("POP3 session ended", { deletedCount });
            resolve();
          });
        }
      });
    }
  });
}
async function processIncomingEmails(db, emails) {
  for (const email of emails) {
    try {
      const phoneNumber = extractPhoneNumber(email);
      if (phoneNumber) {
        const existingLead = await db.select().from(__require("../drizzle/schema").leads).where(
          __require("drizzle-orm").eq(
            __require("../drizzle/schema").leads.phone,
            phoneNumber
          )
        ).limit(1);
        if (existingLead.length === 0) {
          await db.insert(__require("../drizzle/schema").leads).values({
            phone: phoneNumber,
            name: extractNameFromEmail(email),
            email: email.from,
            tenantId: 1,
            // Default tenant - you may want to configure this
            status: "new",
            source: "email",
            createdAt: /* @__PURE__ */ new Date(),
            updatedAt: /* @__PURE__ */ new Date()
          });
          logger.info("Lead created from email", {
            phone: phoneNumber,
            email: email.from,
            subject: email.subject
          });
          await db.insert(__require("../drizzle/schema").messages).values({
            leadId: null,
            // Will be updated with actual lead ID
            tenantId: 1,
            direction: "inbound",
            body: email.text,
            subject: email.subject,
            fromEmail: email.from,
            toEmail: email.to,
            createdAt: email.date,
            updatedAt: /* @__PURE__ */ new Date()
          });
          logger.info("Email communication logged", {
            from: email.from,
            to: email.to,
            subject: email.subject
          });
        } else {
          logger.info("Lead already exists", {
            phone: phoneNumber,
            existingLeadId: existingLead[0].id
          });
          await db.insert(__require("../drizzle/schema").messages).values({
            leadId: existingLead[0].id,
            tenantId: existingLead[0].tenantId,
            direction: "inbound",
            body: email.text,
            subject: email.subject,
            fromEmail: email.from,
            toEmail: email.to,
            createdAt: email.date,
            updatedAt: /* @__PURE__ */ new Date()
          });
        }
      } else {
        logger.warn("No phone number found in email", {
          from: email.from,
          subject: email.subject
        });
      }
    } catch (error) {
      logger.error("Failed to process email", {
        error: String(error),
        messageId: email.messageId
      });
    }
  }
}
function extractPhoneNumber(email) {
  const text2 = `${email.subject} ${email.text}`;
  const patterns = [
    /(\+?1[\s-]?)?\(?(\d{3})\)?[\s-]?(\d{3})[\s-]?(\d{4})/g,
    // US format
    /(\+44[\s-]?)?(\d{4})[\s-]?(\d{3})[\s-]?(\d{3})/g,
    // UK format
    /(\+\d{1,3}[\s-]?)?\(?(\d{1,4})\)?[\s-]?(\d{1,4})[\s-]?(\d{1,4})[\s-]?(\d{1,9})/g
    // International
  ];
  for (const pattern of patterns) {
    const matches = text2.match(pattern);
    if (matches) {
      const match = matches[0].replace(/[^\d+]/g, "");
      if (match.length >= 10) {
        return match.startsWith("+") ? match : `+1${match}`;
      }
    }
  }
  return null;
}
function extractNameFromEmail(email) {
  if (email.headers.from) {
    const nameMatch = email.headers.from.match(/^(.+?)\s+</);
    if (nameMatch) {
      return nameMatch[1].replace(/['"]/g, "").trim();
    }
  }
  if (email.subject) {
    const subjectNameMatch = email.subject.match(/^(.+?)(?:\s+[-:]\s+.*)?$/);
    if (subjectNameMatch && subjectNameMatch[1].length > 2) {
      return subjectNameMatch[1].trim();
    }
  }
  const emailMatch = email.from.match(/([^@]+)@/);
  return emailMatch ? emailMatch[1] : "Unknown";
}
async function checkAndProcessEmails(db) {
  const config = {
    host: process.env.POP3_HOST || "mail.rebooked.org",
    port: parseInt(process.env.POP3_PORT || "995", 10),
    user: process.env.POP3_USER || "",
    password: process.env.POP3_PASSWORD || "",
    tls: process.env.POP3_TLS !== "false"
  };
  if (!config.user || !config.password) {
    return { success: false, error: "POP3 credentials not configured" };
  }
  try {
    const client = await connectPOP3(config);
    const emails = await retrieveEmails(client);
    if (emails.length > 0) {
      await processIncomingEmails(db, emails);
      await deleteEmails(client, emails.length);
      logger.info("Email processing completed", {
        count: emails.length,
        host: config.host
      });
    }
    return {
      success: true,
      messagesProcessed: emails.length
    };
  } catch (error) {
    logger.error("Email processing failed", { error: String(error) });
    return {
      success: false,
      error: String(error)
    };
  }
}
async function testPOP3Connection() {
  const config = {
    host: process.env.POP3_HOST || "mail.rebooked.org",
    port: parseInt(process.env.POP3_PORT || "995", 10),
    user: process.env.POP3_USER || "",
    password: process.env.POP3_PASSWORD || "",
    tls: process.env.POP3_TLS !== "false"
  };
  if (!config.user || !config.password) {
    return { success: false, error: "POP3 credentials not configured" };
  }
  try {
    const client = await connectPOP3(config);
    return new Promise((resolve) => {
      client.stat((err, stats) => {
        client.quit(() => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true });
          }
        });
      });
    });
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// server/services/email.service.ts
init_logger();
var EmailService = class {
  /**
   * Send email using SMTP (local server) or fallback to SendGrid
   */
  static async sendEmail(options) {
    try {
      const result = await sendEmail(options);
      if (result.success) {
        logger.info("Email sent successfully", {
          to: options.to,
          subject: options.subject
        });
      } else {
        logger.warn("Email sending failed", {
          to: options.to,
          subject: options.subject,
          error: result.error
        });
      }
      return result;
    } catch (error) {
      const errorMessage = String(error);
      logger.error("Email service error", {
        to: options.to,
        subject: options.subject,
        error: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  }
  /**
   * Check and process incoming emails from POP3
   */
  static async processIncomingEmails(db) {
    try {
      const result = await checkAndProcessEmails(db);
      if (result.success) {
        logger.info("Email processing completed", {
          messagesProcessed: result.messagesProcessed
        });
      } else {
        logger.warn("Email processing failed", {
          error: result.error
        });
      }
      return result;
    } catch (error) {
      const errorMessage = String(error);
      logger.error("Email processing service error", {
        error: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  }
  /**
   * Test email configuration
   */
  static async testEmailConfiguration() {
    const results = {
      smtp: { success: false, error: "SMTP not configured" },
      pop3: { success: false, error: "POP3 not configured" }
    };
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        const testResult = await sendEmail({
          to: process.env.EMAIL_FROM_ADDRESS || "test@rebooked.org",
          subject: "SMTP Test",
          text: "This is a test email to verify SMTP configuration."
        });
        results.smtp = { success: testResult.success, error: testResult.error };
      } catch (error) {
        results.smtp = { success: false, error: String(error) };
      }
    }
    try {
      const pop3Result = await testPOP3Connection();
      results.pop3 = pop3Result;
    } catch (error) {
      results.pop3 = { success: false, error: String(error) };
    }
    return results;
  }
  /**
   * Get email configuration status
   */
  static getConfigurationStatus() {
    return {
      smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
      pop3: !!(process.env.POP3_USER && process.env.POP3_PASSWORD),
      sendgrid: !!process.env.SENDGRID_API_KEY,
      details: {
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT,
        smtpUser: process.env.SMTP_USER,
        pop3Host: process.env.POP3_HOST,
        pop3Port: process.env.POP3_PORT,
        pop3User: process.env.POP3_USER,
        hasSendGrid: !!process.env.SENDGRID_API_KEY
      }
    };
  }
  /**
   * Send welcome email to new lead
   */
  static async sendWelcomeEmail(leadName, leadEmail, tenantName) {
    const subject = `Welcome to ${tenantName || "Rebooked"}!`;
    const text2 = `Hi ${leadName},

Welcome to ${tenantName || "Rebooked"}! We're excited to have you on board.

We'll be reaching out to you shortly to discuss how we can help you grow your business.

If you have any questions in the meantime, feel free to reply to this email.

Best regards,
The ${tenantName || "Rebooked"} Team`;
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to ${tenantName || "Rebooked"}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .content { padding: 20px 0; }
        .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to ${tenantName || "Rebooked"}!</h1>
        </div>
        <div class="content">
            <p>Hi ${leadName},</p>
            <p>Welcome to ${tenantName || "Rebooked"}! We're excited to have you on board.</p>
            <p>We'll be reaching out to you shortly to discuss how we can help you grow your business.</p>
            <p>If you have any questions in the meantime, feel free to reply to this email.</p>
            <p>Best regards,<br>The ${tenantName || "Rebooked"} Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${(/* @__PURE__ */ new Date()).getFullYear()} ${tenantName || "Rebooked"}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
    return this.sendEmail({
      to: leadEmail,
      subject,
      text: text2,
      html
    });
  }
  /**
   * Send appointment confirmation email
   */
  static async sendAppointmentConfirmation(leadName, leadEmail, appointmentDate, tenantName) {
    const formattedDate = appointmentDate.toLocaleString();
    const subject = "Appointment Confirmation";
    const text2 = `Hi ${leadName},

This is a confirmation of your appointment scheduled for:

${formattedDate}

We look forward to speaking with you!

Best regards,
The ${tenantName || "Rebooked"} Team`;
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Appointment Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .appointment { 
            background: #f8f9fa; 
            border-left: 4px solid #007bff; 
            padding: 15px; 
            margin: 20px 0; 
        }
        .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Appointment Confirmation</h1>
        </div>
        <div class="content">
            <p>Hi ${leadName},</p>
            <p>This is a confirmation of your appointment:</p>
            <div class="appointment">
                <strong>${formattedDate}</strong>
            </div>
            <p>We look forward to speaking with you!</p>
            <p>Best regards,<br>The ${tenantName || "Rebooked"} Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${(/* @__PURE__ */ new Date()).getFullYear()} ${tenantName || "Rebooked"}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
    return this.sendEmail({
      to: leadEmail,
      subject,
      text: text2,
      html
    });
  }
  /**
   * Send follow-up email
   */
  static async sendFollowUpEmail(leadName, leadEmail, message, tenantName) {
    const subject = "Following Up";
    const text2 = `Hi ${leadName},

${message}

Best regards,
The ${tenantName || "Rebooked"} Team`;
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Following Up</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .message { 
            background: #f8f9fa; 
            border-left: 4px solid #28a745; 
            padding: 15px; 
            margin: 20px 0; 
            white-space: pre-wrap;
        }
        .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Following Up</h1>
        </div>
        <div class="content">
            <p>Hi ${leadName},</p>
            <div class="message">${message}</div>
            <p>Best regards,<br>The ${tenantName || "Rebooked"} Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${(/* @__PURE__ */ new Date()).getFullYear()} ${tenantName || "Rebooked"}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
    return this.sendEmail({
      to: leadEmail,
      subject,
      text: text2,
      html
    });
  }
};

// server/_core/graceful-shutdown.ts
var GracefulShutdown = class {
  server = null;
  shutdownHandlers = [];
  isShuttingDown = false;
  constructor() {
    this.setupSignalHandlers();
  }
  /**
   * Register the HTTP server for graceful shutdown
   */
  registerServer(server) {
    this.server = server;
  }
  /**
   * Add custom shutdown handler
   */
  addShutdownHandler(signal, handler) {
    this.shutdownHandlers.push({ signal, handler });
  }
  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const signals = ["SIGTERM", "SIGINT", "SIGUSR2"];
    signals.forEach((signal) => {
      process.on(signal, () => {
        console.log(`
\u{1F6D1} Received ${signal}, starting graceful shutdown...`);
        this.shutdown(signal);
      });
    });
    process.on("uncaughtException", (error) => {
      console.error("\u{1F4A5} Uncaught Exception:", error);
      this.shutdown("uncaughtException");
    });
    process.on("unhandledRejection", (reason, promise) => {
      console.error("\u{1F4A5} Unhandled Rejection at:", promise, "reason:", reason);
      this.shutdown("unhandledRejection");
    });
  }
  /**
   * Perform graceful shutdown
   */
  async shutdown(signal) {
    if (this.isShuttingDown) {
      console.log("\u23F3 Shutdown already in progress...");
      return;
    }
    this.isShuttingDown = true;
    console.log(`\u{1F504} Starting graceful shutdown for signal: ${signal}`);
    const shutdownTasks = [];
    if (this.server) {
      console.log("\u{1F6D1} Stopping HTTP server...");
      shutdownTasks.push(
        new Promise((resolve) => {
          this.server.close(() => {
            console.log("\u2705 HTTP server stopped");
            resolve();
          });
        })
      );
    }
    this.shutdownHandlers.forEach(({ signal: handlerSignal, handler }) => {
      if (handlerSignal === signal || signal === "SIGTERM") {
        console.log(`\u{1F504} Running shutdown handler for: ${handlerSignal}`);
        shutdownTasks.push(handler());
      }
    });
    console.log("\u{1F504} Closing database connections...");
    shutdownTasks.push(this.closeDatabaseConnections());
    console.log("\u{1F9F9} Cleaning up memory...");
    shutdownTasks.push(this.cleanupMemory());
    try {
      await Promise.race([
        Promise.all(shutdownTasks),
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Shutdown timeout")), 3e4)
        )
      ]);
      console.log("\u2705 Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      console.error("\u274C Shutdown error:", error);
      console.log("\u{1F6AA} Forcing exit after timeout");
      process.exit(1);
    }
  }
  /**
   * Close database connections
   */
  async closeDatabaseConnections() {
    return new Promise((resolve) => {
      console.log("\u{1F504} Database connections closed");
      resolve();
    });
  }
  /**
   * Cleanup memory and caches
   */
  async cleanupMemory() {
    return new Promise((resolve) => {
      if (global.gc) {
        global.gc();
        console.log("\u{1F5D1}\uFE0F Forced garbage collection");
      }
      if (typeof clearSearchCache === "function") {
        const { clearSearchCache: clearSearchCache3 } = (init_lead_search_optimization_service(), __toCommonJS(lead_search_optimization_service_exports));
        clearSearchCache3();
        console.log("\u{1F9F9} Search cache cleared");
      }
      console.log("\u2705 Memory cleanup completed");
      resolve();
    });
  }
  /**
   * Health check during shutdown
   */
  isShuttingDownActive() {
    return this.isShuttingDown;
  }
};
var gracefulShutdown = new GracefulShutdown();

// server/worker.ts
var POLL_INTERVAL_MS = 6e4;
var MAX_RETRY_ATTEMPTS = 3;
var HEARTBEAT_FILE = process.env.WORKER_HEARTBEAT_FILE || "/tmp/worker-heartbeat.json";
var mins = (n) => n * 6e4;
var hours = (n) => n * 36e5;
var days = (n) => n * 864e5;
function ago(ms) {
  return new Date(Date.now() - ms);
}
function fromNow(ms) {
  return new Date(Date.now() + ms);
}
function getTzOffsetMs(timezone) {
  try {
    const now = /* @__PURE__ */ new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset"
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "UTC+0";
    const match = offsetPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!match) return 0;
    const sign = match[1] === "+" ? 1 : -1;
    const h = parseInt(match[2], 10);
    const m = parseInt(match[3] ?? "0", 10);
    return sign * (h * 36e5 + m * 6e4);
  } catch {
    return 0;
  }
}
async function buildSentSet(db, tenantId, automationId, leadIds) {
  if (leadIds.length === 0) return /* @__PURE__ */ new Set();
  const rows = await db.select({ leadId: messages.leadId }).from(messages).where(and9(
    eq10(messages.tenantId, tenantId),
    eq10(messages.automationId, automationId),
    sql9`${messages.leadId} IN (${sql9.join(leadIds.map((id) => sql9`${id}`), sql9`, `)})`
  ));
  return new Set(rows.map((r) => String(r.leadId)));
}
async function sendWithRetry2(phone, body, fromNumber, tenantId, attempt = 1) {
  const res = await sendSMS(phone, body, fromNumber, tenantId);
  if (res.success) return res;
  if (attempt < MAX_RETRY_ATTEMPTS) {
    const backoff = Math.pow(2, attempt) * 1e3;
    logger.warn("SMS failed, retrying", { attempt, backoff, error: res.error, tenantId });
    await new Promise((r) => setTimeout(r, backoff));
    return sendWithRetry2(phone, body, fromNumber, tenantId, attempt + 1);
  }
  return res;
}
async function fireAutomation(db, tenantId, leadId, leadPhone, leadName, automationId, messageBody, fromNumber) {
  const decryptedPhone = decrypt(leadPhone);
  const decryptedName = leadName ? decrypt(leadName) : null;
  const vars = { name: decryptedName || "there" };
  const resolved = resolveTemplate(messageBody, vars);
  const res = await sendWithRetry2(decryptedPhone, resolved, fromNumber, tenantId);
  await createMessage(db, {
    tenantId,
    leadId,
    direction: "outbound",
    body: resolved,
    fromNumber,
    toNumber: decryptedPhone,
    twilioSid: res.sid,
    status: res.success ? "sent" : "failed",
    automationId,
    provider: res.provider,
    providerError: res.errorCode || res.error,
    retryCount: res.retryCount || 0,
    deliveredAt: res.success ? /* @__PURE__ */ new Date() : void 0,
    failedAt: res.success ? void 0 : /* @__PURE__ */ new Date()
  });
  await db.update(automations).set({
    runCount: sql9`${automations.runCount} + 1`,
    lastRunAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq10(automations.id, automationId));
  logger.info("Automation fired", {
    automationId,
    leadId,
    tenantId,
    success: res.success,
    provider: res.provider
  });
}
function getActionMessage(auto) {
  const actions = auto.actions;
  if (!actions?.length) return null;
  return actions.find((a) => a.type === "send_message" || a.type === "sms")?.body ?? null;
}
function cfg(auto, key, fallback) {
  const v = auto.triggerConfig?.[key];
  return typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) || fallback : fallback;
}
function leadTags(lead) {
  return Array.isArray(lead.tags) ? lead.tags.filter((tag) => typeof tag === "string") : [];
}
function leadHasTag(lead, tag) {
  return leadTags(lead).includes(tag);
}
async function hasInboundKeywordReply(db, leadId, keywords) {
  const replies = await db.select({ body: messages.body }).from(messages).where(and9(eq10(messages.leadId, leadId), eq10(messages.direction, "inbound"))).orderBy(desc7(messages.createdAt)).limit(10);
  const lowered = keywords.map((keyword) => keyword.toLowerCase());
  return replies.some((reply) => lowered.some((keyword) => String(reply.body || "").toLowerCase().includes(keyword)));
}
async function hasOutboundSince(db, leadId, since) {
  const rows = await db.select({ id: messages.id }).from(messages).where(and9(eq10(messages.leadId, leadId), eq10(messages.direction, "outbound"), gt(messages.createdAt, since))).limit(1);
  return rows.length > 0;
}
async function isVipLead(db, leadId, lead) {
  if (leadHasTag(lead, "vip")) return true;
  const counts = await db.select({ count: sql9`count(*)` }).from(messages).where(eq10(messages.leadId, leadId));
  return Number(counts[0]?.count ?? 0) >= 6 || leadHasTag(lead, "booked_client");
}
async function processNewLeadWelcome(db, auto, fromNumber) {
  const newLeads = await db.select().from(leads).where(and9(
    eq10(leads.tenantId, auto.tenantId),
    gt(leads.createdAt, ago(mins(2))),
    sql9`${leads.status} NOT IN ('unsubscribed')`
  ));
  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, newLeads.map((l) => l.id));
  for (const lead of newLeads) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}
async function processFollowUp(db, auto, fromNumber, delayDays) {
  const target = ago(days(delayDays));
  const window = ago(days(delayDays + 1));
  const stale = await db.select().from(leads).where(and9(
    eq10(leads.tenantId, auto.tenantId),
    lt(leads.createdAt, target),
    gt(leads.createdAt, window),
    sql9`${leads.status} NOT IN ('booked', 'lost', 'unsubscribed')`
  ));
  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, stale.map((l) => l.id));
  for (const lead of stale) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}
async function processAppointmentReminder(db, auto, fromNumber, delayHours, tenantTimezone) {
  const nowUtc = Date.now();
  const tzOffset = getTzOffsetMs(tenantTimezone);
  const windowStart = new Date(nowUtc + hours(delayHours) - mins(1) - tzOffset);
  const windowEnd = new Date(nowUtc + hours(delayHours) + mins(1) - tzOffset);
  const upcoming = await db.select().from(leads).where(and9(
    eq10(leads.tenantId, auto.tenantId),
    isNotNull(leads.appointmentAt),
    gt(leads.appointmentAt, windowStart),
    lt(leads.appointmentAt, windowEnd),
    sql9`${leads.status} NOT IN ('lost', 'unsubscribed')`
  ));
  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, upcoming.map((l) => l.id));
  for (const lead of upcoming) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    const apptDate = lead.appointmentAt ? new Date(lead.appointmentAt) : /* @__PURE__ */ new Date();
    const body = msg.replace("{{time}}", apptDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: tenantTimezone })).replace("{{date}}", apptDate.toLocaleDateString("en-US", { timeZone: tenantTimezone }));
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, body, fromNumber);
  }
}
async function processNoShow(db, auto, fromNumber, delayMinutes) {
  const windowStart = ago(mins(delayMinutes + 1));
  const windowEnd = ago(mins(delayMinutes - 1));
  const noShows = await db.select().from(leads).where(and9(
    eq10(leads.tenantId, auto.tenantId),
    isNotNull(leads.appointmentAt),
    gt(leads.appointmentAt, windowStart),
    lt(leads.appointmentAt, windowEnd),
    sql9`${leads.status} NOT IN ('booked', 'unsubscribed')`
  ));
  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, noShows.map((l) => l.id));
  for (const lead of noShows) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}
async function processWinBack(db, auto, fromNumber, delayDays) {
  const target = ago(days(delayDays));
  const window = ago(days(delayDays + 1));
  const lapsed = await db.select().from(leads).where(and9(
    eq10(leads.tenantId, auto.tenantId),
    isNotNull(leads.lastMessageAt),
    lt(leads.lastMessageAt, target),
    gt(leads.lastMessageAt, window),
    sql9`${leads.status} NOT IN ('lost', 'unsubscribed')`
  ));
  const sentSetWb = await buildSentSet(db, auto.tenantId, auto.id, lapsed.map((l) => l.id));
  for (const lead of lapsed) {
    if (sentSetWb.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}
async function processPostAppointment(db, auto, fromNumber, delayHours) {
  const target = ago(hours(delayHours));
  const window = ago(hours(delayHours + 1));
  const completed = await db.select().from(leads).where(and9(
    eq10(leads.tenantId, auto.tenantId),
    isNotNull(leads.appointmentAt),
    lt(leads.appointmentAt, target),
    gt(leads.appointmentAt, window),
    eq10(leads.status, "booked")
  ));
  const sentSetPa = await buildSentSet(db, auto.tenantId, auto.id, completed.map((l) => l.id));
  for (const lead of completed) {
    if (sentSetPa.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}
async function processConfirmationChase(db, auto, fromNumber, delayHours, tenantTimezone) {
  const nowUtc = Date.now();
  const tzOffset = getTzOffsetMs(tenantTimezone);
  const windowStart = new Date(nowUtc + hours(delayHours) - mins(1) - tzOffset);
  const windowEnd = new Date(nowUtc + hours(delayHours) + mins(1) - tzOffset);
  const leadsToChase = await db.select().from(leads).where(and9(
    eq10(leads.tenantId, auto.tenantId),
    eq10(leads.status, "booked"),
    isNotNull(leads.appointmentAt),
    gt(leads.appointmentAt, windowStart),
    lt(leads.appointmentAt, windowEnd)
  ));
  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, leadsToChase.map((l) => l.id));
  for (const lead of leadsToChase) {
    if (sentSet.has(String(lead.id))) continue;
    const replied = await hasInboundKeywordReply(db, lead.id, ["confirm", "confirmed", "reschedule", "cancel"]);
    if (replied) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}
async function processInboundResponseSla(db, auto, fromNumber, delayMinutes) {
  const windowStart = ago(mins(delayMinutes + 1));
  const windowEnd = ago(mins(delayMinutes - 1));
  const recentInbound = await db.select().from(leads).where(and9(
    eq10(leads.tenantId, auto.tenantId),
    isNotNull(leads.lastInboundAt),
    gt(leads.lastInboundAt, windowStart),
    lt(leads.lastInboundAt, windowEnd),
    sql9`${leads.status} NOT IN ('lost', 'unsubscribed')`
  ));
  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, recentInbound.map((l) => l.id));
  for (const lead of recentInbound) {
    if (sentSet.has(String(lead.id))) continue;
    if (!lead.lastInboundAt) continue;
    const staffReplied = await hasOutboundSince(db, lead.id, new Date(lead.lastInboundAt));
    if (staffReplied) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}
async function processQualifiedFollowUp(db, auto, fromNumber, delayDays) {
  const target = ago(days(delayDays));
  const window = ago(days(delayDays + 1));
  const qualified = await db.select().from(leads).where(and9(
    eq10(leads.tenantId, auto.tenantId),
    eq10(leads.status, "qualified"),
    lt(leads.createdAt, target),
    gt(leads.createdAt, window),
    sql9`${leads.appointmentAt} IS NULL`
  ));
  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, qualified.map((l) => l.id));
  for (const lead of qualified) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}
async function processDeliveryFailureRecovery(db, auto, fromNumber, delayMinutes) {
  const windowStart = ago(mins(delayMinutes + 1));
  const windowEnd = ago(mins(delayMinutes - 1));
  const failedRows = await db.select({ leadId: messages.leadId }).from(messages).where(and9(
    eq10(messages.tenantId, auto.tenantId),
    eq10(messages.direction, "outbound"),
    eq10(messages.status, "failed"),
    isNotNull(messages.failedAt),
    gt(messages.failedAt, windowStart),
    lt(messages.failedAt, windowEnd)
  ));
  const leadIds = Array.from(new Set(failedRows.map((r) => r.leadId)));
  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, leadIds);
  for (const leadId of leadIds) {
    if (sentSet.has(String(leadId))) continue;
    const lead = await db.select().from(leads).where(and9(eq10(leads.id, leadId), eq10(leads.tenantId, auto.tenantId))).limit(1);
    const record = lead[0];
    if (!record || record.status === "unsubscribed") continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, record.tenantId, record.id, record.phone, record.name, auto.id, msg, fromNumber);
  }
}
async function processCancellationRescue(db, auto, fromNumber, delayHours) {
  const target = ago(hours(delayHours));
  const window = ago(hours(delayHours + 24));
  const cancelled = await db.select().from(leads).where(and9(
    eq10(leads.tenantId, auto.tenantId),
    lt(leads.updatedAt, target),
    gt(leads.updatedAt, window),
    sql9`${leads.status} NOT IN ('booked', 'unsubscribed')`
  ));
  const candidates = cancelled.filter((lead) => leadHasTag(lead, "cancelled"));
  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, candidates.map((l) => l.id));
  for (const lead of candidates) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}
async function processWaitlistFill(db, auto, fromNumber, candidateWindowDays) {
  const cancellations = await db.select().from(leads).where(and9(
    eq10(leads.tenantId, auto.tenantId),
    gt(leads.updatedAt, ago(hours(1))),
    sql9`${leads.status} NOT IN ('booked', 'unsubscribed')`
  ));
  if (!cancellations.some((lead) => leadHasTag(lead, "cancelled"))) return;
  const candidates = await db.select().from(leads).where(and9(
    eq10(leads.tenantId, auto.tenantId),
    gt(leads.createdAt, ago(days(candidateWindowDays))),
    sql9`${leads.status} IN ('new', 'contacted', 'qualified')`,
    sql9`${leads.appointmentAt} IS NULL`
  ));
  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, candidates.map((l) => l.id));
  for (const lead of candidates.slice(0, 5)) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}
async function processVipWinBack(db, auto, fromNumber, delayDays) {
  const target = ago(days(delayDays));
  const window = ago(days(delayDays + 7));
  const lapsed = await db.select().from(leads).where(and9(
    eq10(leads.tenantId, auto.tenantId),
    eq10(leads.status, "booked"),
    isNotNull(leads.lastMessageAt),
    lt(leads.lastMessageAt, target),
    gt(leads.lastMessageAt, window)
  ));
  const vipCandidates = [];
  for (const lead of lapsed) {
    if (await isVipLead(db, lead.id, lead)) {
      vipCandidates.push(lead);
    }
  }
  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, vipCandidates.map((l) => l.id));
  for (const lead of vipCandidates) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}
async function buildPhoneCache(db, tenantIds) {
  if (tenantIds.length === 0) return /* @__PURE__ */ new Map();
  const rows = await db.select({ tenantId: phoneNumbers.tenantId, number: phoneNumbers.number, isDefault: phoneNumbers.isDefault }).from(phoneNumbers).where(and9(
    sql9`${phoneNumbers.tenantId} IN (${sql9.join(tenantIds.map((id) => sql9`${id}`), sql9`, `)})`,
    isNull3(phoneNumbers.deletedAt)
  ));
  const cache = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (!cache.has(row.tenantId) || row.isDefault) {
      cache.set(row.tenantId, row.number);
    }
  }
  return cache;
}
async function buildTimezoneCache(db, tenantIds) {
  if (tenantIds.length === 0) return /* @__PURE__ */ new Map();
  const rows = await db.select({ id: tenants.id, timezone: tenants.timezone }).from(tenants).where(sql9`${tenants.id} IN (${sql9.join(tenantIds.map((id) => sql9`${id}`), sql9`, `)})`);
  const cache = /* @__PURE__ */ new Map();
  for (const row of rows) {
    cache.set(row.id, row.timezone ?? "UTC");
  }
  return cache;
}
async function processTrialReminders(db) {
  const now = /* @__PURE__ */ new Date();
  const threeDays = fromNow(days(3));
  const expiring = await db.select({ sub: subscriptions, tenant: tenants }).from(subscriptions).innerJoin(tenants, eq10(subscriptions.tenantId, tenants.id)).where(and9(
    eq10(subscriptions.status, "trialing"),
    isNotNull(subscriptions.trialEndsAt),
    lt(subscriptions.trialEndsAt, threeDays),
    gt(subscriptions.trialEndsAt, now),
    eq10(subscriptions.trialReminderSent, false)
  ));
  if (expiring.length === 0) return;
  const { sendEmail: sendEmail2 } = await Promise.resolve().then(() => (init_email(), email_exports));
  for (const row of expiring) {
    const email = await getPrimaryUserEmailByTenant(db, row.sub.tenantId);
    if (!email) continue;
    await sendEmail2({
      to: email,
      subject: "Rebooked Trial Ending Soon",
      text: `Your Rebooked trial ends on ${row.sub.trialEndsAt ? new Date(row.sub.trialEndsAt).toLocaleDateString() : "soon"}. Upgrade to keep your automations running.`
    });
    await db.update(subscriptions).set({ trialReminderSent: true, updatedAt: /* @__PURE__ */ new Date() }).where(eq10(subscriptions.id, row.sub.id));
    logger.info("Trial reminder sent", { tenantId: row.sub.tenantId });
  }
}
async function runCycleInner() {
  const db = await getDb();
  if (!db) {
    logger.warn("Worker: DB unavailable, skipping cycle");
    return;
  }
  await processTrialReminders(db);
  await processQueuedAutomationJobs(db);
  try {
    const emailResult = await EmailService.processIncomingEmails(db);
    if (emailResult.success && emailResult.messagesProcessed && emailResult.messagesProcessed > 0) {
      logger.info("Worker: Processed incoming emails", {
        count: emailResult.messagesProcessed
      });
    }
  } catch (error) {
    logger.warn("Worker: Email processing failed", { error: String(error) });
  }
  const allAutomations = await db.select().from(automations).where(and9(eq10(automations.enabled, true), isNull3(automations.deletedAt)));
  if (allAutomations.length === 0) return;
  const entitledTenantIds = /* @__PURE__ */ new Set();
  for (const tenantId of Array.from(new Set(allAutomations.map((a) => a.tenantId)))) {
    if (await tenantHasAutomationAccess(db, tenantId)) {
      entitledTenantIds.add(tenantId);
    }
  }
  const runnableAutomations = allAutomations.filter((automation) => entitledTenantIds.has(automation.tenantId));
  if (runnableAutomations.length === 0) return;
  const tenantIds = Array.from(new Set(runnableAutomations.map((a) => a.tenantId)));
  const phoneCache = await buildPhoneCache(db, tenantIds);
  const timezoneCache = await buildTimezoneCache(db, tenantIds);
  for (const auto of runnableAutomations) {
    const fromNumber = phoneCache.get(auto.tenantId);
    const key = auto.key;
    try {
      if (key === "new_lead_welcome") {
        await processNewLeadWelcome(db, auto, fromNumber);
      } else if (key === "inbound_response_sla") {
        await processInboundResponseSla(db, auto, fromNumber, cfg(auto, "delayMinutes", 10));
      } else if (key === "lead_follow_up_3d") {
        await processFollowUp(db, auto, fromNumber, cfg(auto, "delayDays", 3));
      } else if (key === "lead_follow_up_7d") {
        await processFollowUp(db, auto, fromNumber, cfg(auto, "delayDays", 7));
      } else if (key === "qualified_followup_1d") {
        await processQualifiedFollowUp(db, auto, fromNumber, cfg(auto, "delayDays", 1));
      } else if (key === "qualified_followup_3d") {
        await processQualifiedFollowUp(db, auto, fromNumber, cfg(auto, "delayDays", 3));
      } else if (key === "appointment_reminder_24h") {
        await processAppointmentReminder(db, auto, fromNumber, cfg(auto, "delayHours", 24), timezoneCache.get(auto.tenantId) ?? "UTC");
      } else if (key === "appointment_reminder_2h") {
        await processAppointmentReminder(db, auto, fromNumber, cfg(auto, "delayHours", 2), timezoneCache.get(auto.tenantId) ?? "UTC");
      } else if (key === "appointment_confirmation_chase") {
        await processConfirmationChase(db, auto, fromNumber, cfg(auto, "delayHours", 12), timezoneCache.get(auto.tenantId) ?? "UTC");
      } else if (key === "no_show_follow_up") {
        await processNoShow(db, auto, fromNumber, cfg(auto, "delayMinutes", 60));
      } else if (key === "no_show_rebooking") {
        await processFollowUp(db, auto, fromNumber, cfg(auto, "delayDays", 3));
      } else if (key === "delivery_failure_retry") {
        await processDeliveryFailureRecovery(db, auto, fromNumber, cfg(auto, "delayMinutes", 15));
      } else if (key === "next_visit_prompt") {
        await processPostAppointment(db, auto, fromNumber, cfg(auto, "delayDays", 3) * 24);
      } else if (key === "post_appointment_feedback" || key === "post_appointment_upsell") {
        await processPostAppointment(db, auto, fromNumber, cfg(auto, "delayHours", 2));
      } else if (key === "waitlist_fill") {
        await processWaitlistFill(db, auto, fromNumber, cfg(auto, "candidateWindowDays", 30));
      } else if (key === "cancellation_same_day") {
        await processCancellationRescue(db, auto, fromNumber, cfg(auto, "delayHours", 1));
      } else if (key === "cancellation_rebooking_48h") {
        await processCancellationRescue(db, auto, fromNumber, cfg(auto, "delayHours", 48));
      } else if (key === "cancellation_rebooking_7d") {
        await processCancellationRescue(db, auto, fromNumber, cfg(auto, "delayDays", 7) * 24);
      } else if (key === "win_back_30d") {
        await processWinBack(db, auto, fromNumber, cfg(auto, "delayDays", 30));
      } else if (key === "win_back_90d") {
        await processWinBack(db, auto, fromNumber, cfg(auto, "delayDays", 90));
      } else if (key === "vip_winback_45d") {
        await processVipWinBack(db, auto, fromNumber, cfg(auto, "delayDays", 45));
      } else if (key === "vip_winback_90d") {
        await processVipWinBack(db, auto, fromNumber, cfg(auto, "delayDays", 90));
      } else if (key === "cancellation_rebooking") {
        await processFollowUp(db, auto, fromNumber, cfg(auto, "delayDays", 2));
      }
    } catch (err) {
      logger.error("Worker: automation error", { automationId: auto.id, key, error: String(err) });
      captureException(err, { automationId: auto.id, tenantId: auto.tenantId });
      await db.update(automations).set({ errorCount: sql9`${automations.errorCount} + 1`, updatedAt: /* @__PURE__ */ new Date() }).where(eq10(automations.id, auto.id));
    }
  }
  try {
    writeFileSync(HEARTBEAT_FILE, JSON.stringify({
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      status: "ok",
      lastSuccessAt: (/* @__PURE__ */ new Date()).toISOString(),
      pollIntervalMs: POLL_INTERVAL_MS
    }));
  } catch {
  }
}
async function runCycle() {
  return runWithCorrelationId(randomUUID2(), () => runCycleInner());
}
async function main() {
  await initSentry();
  logger.info("Worker starting", { pollIntervalMs: POLL_INTERVAL_MS });
  gracefulShutdown.addShutdownHandler("SIGTERM", async () => {
    logger.info("Worker SIGTERM - graceful shutdown initiated");
    await new Promise((resolve) => setTimeout(resolve, 2e3));
  });
  gracefulShutdown.addShutdownHandler("SIGINT", async () => {
    logger.info("Worker SIGINT - graceful shutdown initiated");
    await new Promise((resolve) => setTimeout(resolve, 2e3));
  });
  await runCycle();
  const pollInterval = setInterval(async () => {
    try {
      if (gracefulShutdown.isShuttingDownActive()) {
        clearInterval(pollInterval);
        logger.info("Worker polling stopped due to shutdown");
        return;
      }
      await runCycle();
    } catch (err) {
      logger.error("Worker cycle error", { error: String(err) });
      try {
        writeFileSync(HEARTBEAT_FILE, JSON.stringify({
          ts: (/* @__PURE__ */ new Date()).toISOString(),
          status: "error",
          error: String(err),
          pollIntervalMs: POLL_INTERVAL_MS
        }));
      } catch {
      }
      captureException(err);
    }
  }, POLL_INTERVAL_MS);
}
main().catch((err) => {
  logger.error("Worker fatal", { error: String(err) });
  try {
    writeFileSync(HEARTBEAT_FILE, JSON.stringify({
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      status: "error",
      error: String(err),
      pollIntervalMs: POLL_INTERVAL_MS
    }));
  } catch {
  }
  process.exit(1);
});
