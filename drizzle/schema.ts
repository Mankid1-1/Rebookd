import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Core Auth ────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  tenantId: int("tenantId"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;

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
});

export type PhoneNumber = typeof phoneNumbers.$inferSelect;

// ─── Leads ────────────────────────────────────────────────────────────────────

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  status: mysqlEnum("status", ["new", "contacted", "qualified", "booked", "lost", "unsubscribed"]).default("new").notNull(),
  source: varchar("source", { length: 100 }),
  tags: json("tags").$type<string[]>(),
  notes: text("notes"),
  lastMessageAt: timestamp("lastMessageAt"),
  lastInboundAt: timestamp("lastInboundAt"),
  appointmentAt: timestamp("appointmentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
  aiRewritten: boolean("aiRewritten").default(false).notNull(),
  tone: varchar("tone", { length: 50 }),
  automationId: int("automationId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─── Templates ────────────────────────────────────────────────────────────────

export const templates = mysqlTable("templates", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  body: text("body").notNull(),
  tone: mysqlEnum("tone", ["friendly", "professional", "casual", "urgent"]).default("friendly").notNull(),
  variables: json("variables").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;

// ─── Automations ──────────────────────────────────────────────────────────────

export const automations = mysqlTable("automations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  category: mysqlEnum("category", ["follow_up", "reactivation", "appointment", "welcome", "custom"]).default("custom").notNull(),
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
});

export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = typeof automations.$inferInsert;

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
  tenantId: int("tenantId").notNull(),
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
