/**
 * 🗄️ REBOOKD V2 - PRODUCTION DATABASE SCHEMA
 * 
 * Enterprise-grade database schema with:
 * - Complete security and compliance fields
 * - Comprehensive audit trails
 * - Performance-optimized indexing
 * - Data integrity constraints
 * - TCPA, GDPR, PCI DSS compliance
 * 
 * SECURITY LEVEL: HIGH - Contains sensitive financial and PII data
 * COMPLIANCE: TCPA, GDPR, PCI DSS compliant
 * PERFORMANCE: Optimized for high-volume transactions
 */

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
  bigint,
  decimal,
  double,
} from "drizzle-orm/mysql-core";

// ─── Core Authentication & User Management ──────────────────────────────────

/**
 * 📱 USERS TABLE - Production Ready
 * 
 * Core user management with:
 * - Multi-factor authentication support
 * - Security audit fields
 * - GDPR compliance fields
 * - Account status tracking
 * - Session management
 */
export const users = mysqlTable("users", {
  // Primary identification
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  
  // Personal information (PII - encrypted)
  name: text("name"), // Encrypted at rest
  email: varchar("email", { length: 320 }), // Encrypted at rest
  phone: varchar("phone", { length: 20 }), // Encrypted at rest
  
  // Authentication & Security
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  accountType: mysqlEnum("accountType", ["business", "referral", "both"]).default("business").notNull(),
  tenantId: int("tenantId").references(() => tenants.id),
  tenantRole: mysqlEnum("tenantRole", ["owner", "employee"]),
  skillLevel: mysqlEnum("skillLevel", ["basic", "intermediate", "advanced"]).default("basic"),
  skillLevelSetAt: timestamp("skillLevelSetAt"),
  active: boolean("active").default(true).notNull(),
  suspendedAt: timestamp("suspendedAt"),
  suspendedReason: text("suspendedReason"),
  deletedAt: timestamp("deletedAt"), // Soft delete
  
  // Business Association (tenantId already defined above in Authentication section)
  
  // Payment & Billing
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  billingEmail: varchar("billingEmail", { length: 320 }),
  
  // Security & Audit
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  lastSignInIp: varchar("lastSignInIp", { length: 45 }),
  lastSignInUserAgent: text("lastSignInUserAgent"),
  passwordChangedAt: timestamp("passwordChangedAt").defaultNow().notNull(),
  failedLoginAttempts: int("failedLoginAttempts").default(0),
  lockedUntil: timestamp("lockedUntil"),
  
  // GDPR Compliance
  dataProcessingConsent: boolean("dataProcessingConsent").default(false),
  marketingConsent: boolean("marketingConsent").default(false),
  consentRecordedAt: timestamp("consentRecordedAt"),
  consentIpAddress: varchar("consentIpAddress", { length: 45 }),
  
  // Metadata
  preferences: json("preferences"), // User preferences
  metadata: json("metadata"), // Additional metadata
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  // Indexes for performance
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
  tenantIdIdx: index("users_tenant_id_idx").on(t.tenantId),
  openIdIdx: uniqueIndex("users_open_id_idx").on(t.openId),
  stripeCustomerIdIdx: index("users_stripe_customer_id_idx").on(t.stripeCustomerId),
  activeIdx: index("users_active_idx").on(t.active),
  lastSignedInIdx: index("users_last_signed_in_idx").on(t.lastSignedIn),
  
  // Composite indexes for common queries
  tenantActiveIdx: index("users_tenant_active_idx").on(t.tenantId, t.active),
  emailTenantIdx: index("users_email_tenant_idx").on(t.email, t.tenantId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Authentication Tokens & Security ───────────────────────────────────

/**
 * 🔐 EMAIL VERIFICATION TOKENS
 * 
 * Secure email verification with:
 * - Cryptographically secure tokens
 * - Expiration handling
 * - Rate limiting support
 * - Audit trail
 */
export const emailVerificationTokens = mysqlTable("email_verification_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  email: varchar("email", { length: 320 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull(), // SHA-256 hash
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index("email_tokens_user_id_idx").on(t.userId),
  tokenHashIdx: index("email_tokens_token_hash_idx").on(t.tokenHash),
  expiresAtIdx: index("email_tokens_expires_at_idx").on(t.expiresAt),
}));

/**
 * 🔐 PASSWORD RESET TOKENS
 * 
 * Secure password reset with:
 * - High-entropy tokens
 * - Strict expiration
 * - Single-use enforcement
 * - Security monitoring
 */
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull(), // SHA-256 hash
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index("password_tokens_user_id_idx").on(t.userId),
  tokenHashIdx: index("password_tokens_token_hash_idx").on(t.tokenHash),
  expiresAtIdx: index("password_tokens_expires_at_idx").on(t.expiresAt),
}));

/**
 * 🔐 MFA SESSION TOKENS
 * 
 * Multi-factor authentication session management
 */
export const mfaSessionTokens = mysqlTable("mfa_session_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  sessionToken: varchar("sessionToken", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  verifiedAt: timestamp("verifiedAt"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index("mfa_tokens_user_id_idx").on(t.userId),
  sessionTokenIdx: uniqueIndex("mfa_tokens_session_token_idx").on(t.sessionToken),
  expiresAtIdx: index("mfa_tokens_expires_at_idx").on(t.expiresAt),
}));

// ─── Multi-Tenant Business Management ──────────────────────────────────────

/**
 * 🏢 TENANTS TABLE - Production Ready
 * 
 * Multi-tenant business management with:
 * - Complete business information
 * - Compliance tracking
 * - Billing integration
 * - Security settings
 * - Performance metrics
 */
export const tenants = mysqlTable("tenants", {
  // Primary identification
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  
  // Business Information
  industry: mysqlEnum("industry", [
    "healthcare", "beauty", "fitness", "wellness", "professional_services",
    "consulting", "education", "other"
  ]),
  businessType: mysqlEnum("businessType", ["sole_proprietor", "partnership", "llc", "corporation"]),
  employeeCount: int("employeeCount").default(1),
  
  // Location & Contact
  timezone: varchar("timezone", { length: 64 }).default("America/New_York").notNull(),
  address: json("address"), // Encrypted address data
  phone: varchar("phone", { length: 20 }), // Encrypted
  website: varchar("website", { length: 255 }),
  
  // Compliance & Legal
  taxId: varchar("taxId", { length: 50 }), // Encrypted tax identifier
  businessLicense: varchar("businessLicense", { length: 100 }),
  complianceStatus: mysqlEnum("complianceStatus", ["pending", "verified", "flagged", "suspended"]).default("pending"),
  complianceReviewedAt: timestamp("complianceReviewedAt"),
  complianceNotes: text("complianceNotes"),
  
  // Billing & Subscription
  plan: mysqlEnum("plan", ["starter", "growth", "scale"]).default("starter"),
  billingType: mysqlEnum("billingType", ["founder", "flex", "standard"]).default("standard").notNull(),
  billingEmail: varchar("billingEmail", { length: 320 }),
  billingAddress: json("billingAddress"), // Encrypted
  paymentMethodId: varchar("paymentMethodId", { length: 255 }),
  
  // Usage & Limits
  maxUsers: int("maxUsers").default(1),
  maxContacts: int("maxContacts").default(500),
  maxMessages: int("maxMessages").default(1000),
  
  // Security Settings
  twoFactorRequired: boolean("twoFactorRequired").default(false),
  ipWhitelist: json("ipWhitelist"), // Allowed IP ranges
  sessionTimeout: int("sessionTimeout").default(480), // minutes
  
  // Status & Health
  active: boolean("active").default(true).notNull(),
  settings: json("settings").$type<Record<string, any>>(),
  locale: varchar("locale", { length: 10 }).default("en").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  country: varchar("country", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  // Indexes for performance
  slugIdx: uniqueIndex("tenants_slug_idx").on(t.slug),
  industryIdx: index("tenants_industry_idx").on(t.industry),
  planIdx: index("tenants_plan_idx").on(t.plan),
  activeIdx: index("tenants_active_idx").on(t.active),
  complianceStatusIdx: index("tenants_compliance_status_idx").on(t.complianceStatus),
  
  // Composite indexes
  activePlanIdx: index("tenants_active_plan_idx").on(t.active, t.plan),
  industryActiveIdx: index("tenants_industry_active_idx").on(t.industry, t.active),
  billingTypeIdx: index("tenants_billing_type_idx").on(t.billingType),
}));

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

// ─── Tenant Invitations ─────────────────────────────────────────────────────

export const tenantInvitations = mysqlTable("tenant_invitations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  email: varchar("email", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["employee"]).default("employee"),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  tenantIdIdx: index("tenant_invitations_tenant_id_idx").on(t.tenantId),
  emailIdx: index("tenant_invitations_email_idx").on(t.email),
}));

export type TenantInvitation = typeof tenantInvitations.$inferSelect;
export type InsertTenantInvitation = typeof tenantInvitations.$inferInsert;

// ─── Plans & Subscriptions ────────────────────────────────────────────────────

/**
 * 💳 PLANS TABLE - Production Ready
 * 
 * Subscription plan management with:
 * - Dual pricing model (fixed + revenue share)
 * - Feature tiering
 * - Usage limits
 * - Stripe integration
 * - Compliance tracking
 */
export const plans = mysqlTable("plans", {
  // Primary identification
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  
  // Pricing Structure (Simplified Model)
  priceMonthly: int("priceMonthly").default(199).notNull(), // $199 fixed monthly fee
  revenueSharePercent: int("revenueSharePercent").default(15).notNull(), // 15% revenue share
  
  // Early Adopter Benefits (First 20 clients)
  earlyAdopterSlots: int("earlyAdopterSlots").default(20), // First 20 clients get special terms
  earlyAdopterFree: boolean("earlyAdopterFree").default(true), // Free if ROI not positive
  earlyAdopterGuarantee: text("earlyAdopterGuarantee"), // "Free if doesn't make more money than costs"
  
  // Stripe Integration
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  stripeAnnualPriceId: varchar("stripeAnnualPriceId", { length: 255 }),
  stripeProductId: varchar("stripeProductId", { length: 255 }),
  
  // Limits & Quotas
  maxUsers: int("maxUsers").default(1),
  maxContacts: int("maxContacts").default(500),
  maxMessages: int("maxMessages").default(1000),
  maxAutomations: int("maxAutomations").default(5),
  maxApiCalls: int("maxApiCalls").default(10000),
  
  // Features & Capabilities
  features: json("features").$type<string[]>(),
  advancedFeatures: json("advancedFeatures").$type<string[]>(),
  integrations: json("integrations").$type<string[]>(),
  
  // Promotional & Trial Settings
  trialDays: int("trialDays").default(30),
  promotionalSlots: int("promotionalSlots").default(0),
  promotionalPriceCap: int("promotionalPriceCap").default(0),
  hasPromotion: boolean("hasPromotion").default(false),
  
  // Compliance & Legal
  complianceLevel: mysqlEnum("complianceLevel", ["basic", "standard", "enterprise"]).default("basic"),
  slaGuarantee: decimal("slaGuarantee", { precision: 5, scale: 2 }).default("99.9"),
  
  // Status & Availability
  active: boolean("active").default(true).notNull(),
  public: boolean("public").default(true).notNull(),
  deprecatedAt: timestamp("deprecatedAt"),
  
  // Metadata
  metadata: json("metadata"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  // Indexes for performance
  slugIdx: uniqueIndex("plans_slug_idx").on(t.slug),
  activeIdx: index("plans_active_idx").on(t.active),
  publicIdx: index("plans_public_idx").on(t.public),
  stripePriceIdIdx: index("plans_stripe_price_id_idx").on(t.stripePriceId),
}));

export type Plan = typeof plans.$inferSelect;

/**
 * 💳 SUBSCRIPTIONS TABLE - Production Ready
 * 
 * Subscription management with:
 * - Complete Stripe integration
 * - Dual pricing model support
 * - Usage tracking
 * - Revenue recognition
 * - Compliance monitoring
 */
export const subscriptions = mysqlTable("subscriptions", {
  // Primary identification
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  planId: int("planId").notNull().references(() => plans.id),
  
  // Stripe Integration
  stripeId: varchar("stripeId", { length: 255 }).unique(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }).unique(),
  
  // Subscription Status
  status: mysqlEnum("status", [
    "trialing", "active", "past_due", "canceled", "unpaid", "incomplete"
  ]).default("trialing").notNull(),
  
  // Trial Management
  trialEndsAt: timestamp("trialEndsAt"),
  trialReminderSent: boolean("trialReminderSent").default(false),
  trialExtended: boolean("trialExtended").default(false),
  
  // Billing Period
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  isPromotional: boolean("isPromotional").default(false).notNull(),
  customMonthlyPrice: int("customMonthlyPrice"),
  promotionalExpiresAt: timestamp("promotionalExpiresAt"),
  // Stripe subscription details (consolidated from stripe_subscriptions)
  userId: int("userId").references(() => users.id),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  stripeQuantity: int("stripeQuantity").default(1),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false),
  canceledAt: timestamp("canceledAt"),
  endedAt: timestamp("endedAt"),
  latestInvoiceId: varchar("latestInvoiceId", { length: 255 }),
  paymentMethodId: varchar("paymentMethodId", { length: 255 }),
  stripeMetadata: json("stripeMetadata"),

  // ROI Guarantee fields
  guaranteeCohort: varchar("guaranteeCohort", { length: 50 }),
  guaranteeStatus: mysqlEnum("guaranteeStatus", ["pending", "active", "passed", "failed", "refunded"]),
  guaranteeStartedAt: timestamp("guaranteeStartedAt"),
  guaranteeExpiresAt: timestamp("guaranteeExpiresAt"),
  lastRoiCheckAt: timestamp("lastRoiCheckAt"),
  lastRoiAmount: int("lastRoiAmount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  // Indexes for performance
  tenantIdIdx: index("subscriptions_tenant_id_idx").on(t.tenantId),
  planIdIdx: index("subscriptions_plan_id_idx").on(t.planId),
  stripeIdIdx: uniqueIndex("subscriptions_stripe_id_idx").on(t.stripeId),
  stripeSubscriptionIdIdx: uniqueIndex("subscriptions_stripe_subscription_id_idx").on(t.stripeSubscriptionId),
  statusIdx: index("subscriptions_status_idx").on(t.status),
  
  // Composite indexes
  tenantStatusIdx: index("subscriptions_tenant_status_idx").on(t.tenantId, t.status),
  billingPeriodIdx: index("subscriptions_billing_period_idx").on(t.currentPeriodStart, t.currentPeriodEnd),
}));

export type Subscription = typeof subscriptions.$inferSelect;

export const billingInvoices = mysqlTable("billing_invoices", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  subscriptionId: int("subscriptionId").references(() => subscriptions.id),
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
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  subscriptionId: int("subscriptionId").references(() => subscriptions.id),
  billingInvoiceId: int("billingInvoiceId").references(() => billingInvoices.id),
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
  tenantId: int("tenantId").notNull().references(() => tenants.id),
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
  tenantId: int("tenantId").notNull().references(() => tenants.id),
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
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  phone: varchar("phone", { length: 500 }).notNull(),
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
  // Per-lead retention & personalization fields (migration 0017)
  birthday: varchar("birthday", { length: 10 }), // DATE stored as "YYYY-MM-DD" string for portability
  visitCount: int("visitCount").default(0).notNull(),
  loyaltyTier: varchar("loyaltyTier", { length: 50 }), // "bronze", "silver", "gold", "platinum"
  timezone: varchar("timezone", { length: 64 }), // IANA timezone e.g. "America/New_York", null = use tenant default
  // TCPA Compliance fields
  smsConsentAt: timestamp("smsConsentAt"),
  smsConsentSource: varchar("smsConsentSource", { length: 100 }), // "form", "manual", "import", etc.
  tcpaConsentText: text("tcpaConsentText"), // Store the exact consent language
  unsubscribedAt: timestamp("unsubscribedAt"),
  unsubscribeMethod: varchar("unsubscribeMethod", { length: 50 }), // "sms_stop", "manual", etc.
  // Recovery attribution fields (added by migration 0007)
  recoverySource: varchar("recoverySource", { length: 100 }),
  recoveredFromLeadId: int("recoveredFromLeadId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tenantIdIdx: index("leads_tenant_id_idx").on(t.tenantId),
  phoneHashIdx: uniqueIndex("leads_phone_hash_idx").on(t.tenantId, t.phoneHash),
  statusIdx: index("leads_status_idx").on(t.tenantId, t.status),
  createdAtIdx: index("leads_created_at_idx").on(t.tenantId, t.createdAt),
  searchIdx: index("leads_search_idx").on(t.tenantId, t.name, t.email),
  consentIdx: index("leads_consent_idx").on(t.tenantId, t.smsConsentAt),
  birthdayIdx: index("leads_birthday_idx").on(t.tenantId, t.birthday),
  visitCountIdx: index("leads_visit_count_idx").on(t.tenantId, t.visitCount),
}));

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  leadId: int("leadId").notNull().references(() => leads.id),
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
  automationId: int("automationId").references(() => automations.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  tenantIdIdx: index("messages_tenant_id_idx").on(t.tenantId),
  leadIdIdx: index("messages_lead_id_idx").on(t.leadId),
  tenantLeadIdx: index("messages_tenant_lead_idx").on(t.tenantId, t.leadId),
  createdAtIdx: index("messages_created_at_idx").on(t.tenantId, t.createdAt),
  idempotencyKeyIdx: uniqueIndex("messages_idempotency_key_idx").on(t.tenantId, t.idempotencyKey),
}));

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─── Templates ────────────────────────────────────────────────────────────────

export const templates = mysqlTable("templates", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
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
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  category: mysqlEnum("category", ["follow_up", "reactivation", "appointment", "welcome", "custom", "no_show", "cancellation", "loyalty", "review", "rescheduling", "waiting_list", "lead_capture"]).default("custom").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  triggerType: mysqlEnum("triggerType", ["new_lead", "inbound_message", "status_change", "time_delay", "appointment_reminder", "missed_call", "cancellation_flurry", "win_back", "birthday", "loyalty_milestone", "review_request", "waitlist_slot_opened", "rescheduling"]).default("new_lead").notNull(),
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
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  automationId: int("automationId").notNull().references(() => automations.id),
  leadId: int("leadId").references(() => leads.id),
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

// ─── Automation Logs (Audit Trail) ────────────────────────────────────────────

export const automationLogs = mysqlTable("automation_logs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  automationId: int("automationId").notNull().references(() => automations.id),
  automationKey: varchar("automationKey", { length: 100 }).notNull(),
  leadId: int("leadId").references(() => leads.id),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  stepIndex: int("stepIndex").default(0).notNull(),
  stepType: varchar("stepType", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["started", "completed", "failed", "skipped", "tcpa_blocked"]).default("started").notNull(),
  recoveryState: mysqlEnum("recoveryState", ["detected", "contacted", "recovered", "billed"]),
  recoveryEventId: int("recoveryEventId"),
  durationMs: int("durationMs"),
  errorMessage: text("errorMessage"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  tenantAutomationIdx: index("idx_autolog_tenant_automation").on(t.tenantId, t.automationId),
  tenantLeadIdx: index("idx_autolog_tenant_lead").on(t.tenantId, t.leadId),
  tenantStatusIdx: index("idx_autolog_tenant_status").on(t.tenantId, t.status),
  tenantRecoveryIdx: index("idx_autolog_tenant_recovery").on(t.tenantId, t.recoveryState),
  tenantCreatedIdx: index("idx_autolog_tenant_created").on(t.tenantId, t.createdAt),
}));

export type AutomationLog = typeof automationLogs.$inferSelect;
export type InsertAutomationLog = typeof automationLogs.$inferInsert;

// ─── n8n Dead Letter Queue ───────────────────────────────────────────────────

export const n8nDeadLetterQueue = mysqlTable("n8n_dead_letter_queue", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  eventId: varchar("eventId", { length: 100 }),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  errorMessage: text("errorMessage"),
  attempts: int("attempts").notNull().default(0),
  maxAttempts: int("maxAttempts").notNull().default(5),
  status: mysqlEnum("status", ["pending", "reprocessing", "succeeded", "exhausted"]).default("pending").notNull(),
  lastAttemptAt: timestamp("lastAttemptAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  statusIdx: index("idx_dlq_status").on(t.status, t.createdAt),
  tenantIdx: index("idx_dlq_tenant").on(t.tenantId),
}));

export type N8nDeadLetterEntry = typeof n8nDeadLetterQueue.$inferSelect;

// ─── n8n Workflow Sync ───────────────────────────────────────────────────────

export const n8nWorkflowSync = mysqlTable("n8n_workflow_sync", {
  id: int("id").autoincrement().primaryKey(),
  workflowKey: varchar("workflowKey", { length: 100 }).notNull(),
  n8nWorkflowId: varchar("n8nWorkflowId", { length: 50 }),
  n8nActive: boolean("n8nActive").default(false).notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  syncStatus: mysqlEnum("syncStatus", ["synced", "drift_detected", "missing_in_n8n", "unknown_in_rebooked"]).default("synced").notNull(),
  n8nVersion: int("n8nVersion").default(0).notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  workflowKeyIdx: uniqueIndex("uq_workflow_key").on(t.workflowKey),
  syncStatusIdx: index("idx_sync_status").on(t.syncStatus),
}));

export type N8nWorkflowSyncEntry = typeof n8nWorkflowSync.$inferSelect;

// ─── AI Message Logs ──────────────────────────────────────────────────────────

export const aiMessageLogs = mysqlTable("ai_message_logs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  leadId: int("leadId").references(() => leads.id),
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
  tenantId: int("tenantId").references(() => tenants.id),
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
  tenantId: int("tenantId").notNull().references(() => tenants.id),
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
  type: mysqlEnum("type", ["twilio", "ai", "automation", "billing", "webhook", "system", "client"]).notNull(),
  message: text("message").notNull(),
  detail: text("detail"),
  tenantId: int("tenantId").references(() => tenants.id),
  resolved: boolean("resolved").default(false).notNull(),
  stackTraceHash: varchar("stackTraceHash", { length: 64 }),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium"),
  errorCategory: mysqlEnum("errorCategory", ["runtime", "graphical", "rendering", "network", "performance"]).default("runtime"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  hashIdx: index("sel_stack_trace_hash_idx").on(t.stackTraceHash),
  resolvedIdx: index("sel_resolved_idx").on(t.resolved),
  severityIdx: index("sel_severity_idx").on(t.severity),
  categoryIdx: index("sel_category_idx").on(t.errorCategory),
}));

export type SystemErrorLog = typeof systemErrorLogs.$inferSelect;

export const adminAuditLogs = mysqlTable("admin_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("adminUserId").notNull().references(() => users.id),
  adminEmail: varchar("adminEmail", { length: 320 }),
  action: varchar("action", { length: 120 }).notNull(),
  targetTenantId: int("targetTenantId").references(() => tenants.id),
  targetUserId: int("targetUserId").references(() => users.id),
  route: varchar("route", { length: 255 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;

export const smsRateLimits = mysqlTable("sms_rate_limits", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
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
    tenantId: int("tenantId").notNull().references(() => tenants.id),
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
  referrerId: int("referrer_id").notNull().references(() => users.id),
  referredUserId: int("referred_user_id").notNull().references(() => users.id),
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
  userId: int("userId").notNull().references(() => users.id),
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


// ─── Recovery Attribution ─────────────────────────────────────────────────────

export const recoveryEvents = mysqlTable("recovery_events", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  leadId: int("leadId").notNull().references(() => leads.id),
  automationId: int("automationId").references(() => automations.id),
  messageId: int("messageId").references(() => messages.id),
  originalAppointmentId: varchar("originalAppointmentId", { length: 255 }),
  recoveredAppointmentId: varchar("recoveredAppointmentId", { length: 255 }),
  leakageType: varchar("leakageType", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["sent", "responded", "converted", "realized", "manual_realized", "failed", "expired"]).default("sent").notNull(),
  trackingToken: varchar("trackingToken", { length: 64 }).notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 255 }),
  estimatedRevenue: int("estimatedRevenue").default(0).notNull(),
  realizedRevenue: int("realizedRevenue").default(0).notNull(),
  attributionModel: varchar("attributionModel", { length: 50 }).default("last_touch").notNull(),
  isPrimaryAttribution: boolean("isPrimaryAttribution").default(false).notNull(),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 4 }).default("0.1500").notNull(),
  commissionAmount: int("commissionAmount").default(0).notNull(),
  commissionStatus: mysqlEnum("commissionStatus", ["pending", "invoiced", "paid"]).default("pending").notNull(),
  commissionInvoiceId: varchar("commissionInvoiceId", { length: 255 }),
  notes: text("notes"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  respondedAt: timestamp("respondedAt"),
  convertedAt: timestamp("convertedAt"),
  realizedAt: timestamp("realizedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RecoveryEvent = typeof recoveryEvents.$inferSelect;
export type InsertRecoveryEvent = typeof recoveryEvents.$inferInsert;

// ─── Feature Configs ──────────────────────────────────────────────────────────

export const featureConfigs = mysqlTable("feature_configs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  feature: varchar("feature", { length: 100 }).notNull(),
  config: json("config").$type<Record<string, unknown>>(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FeatureConfig = typeof featureConfigs.$inferSelect;

// ─── Calendar Integration ──────────────────────────────────────────────────────

export const calendarConnections = mysqlTable("calendar_connections", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  provider: mysqlEnum("provider", ["google", "outlook", "caldav", "calendly", "acuity"]).notNull(),
  label: varchar("label", { length: 255 }),
  accessToken: text("accessToken"),  // Encrypted at rest
  refreshToken: text("refreshToken"), // Encrypted at rest
  externalCalendarId: varchar("externalCalendarId", { length: 255 }),
  externalAccountId: varchar("externalAccountId", { length: 255 }),
  syncEnabled: boolean("syncEnabled").default(true).notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  syncIntervalMinutes: int("syncIntervalMinutes").default(5).notNull(),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tenantIdx: index("cal_conn_tenant_idx").on(t.tenantId),
  providerIdx: index("cal_conn_provider_idx").on(t.tenantId, t.provider),
  syncIdx: index("cal_conn_sync_idx").on(t.syncEnabled, t.lastSyncAt),
}));

export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type InsertCalendarConnection = typeof calendarConnections.$inferInsert;

export const calendarEvents = mysqlTable("calendar_events", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  calendarConnectionId: int("calendarConnectionId").notNull().references(() => calendarConnections.id),
  externalEventId: varchar("externalEventId", { length: 255 }).notNull(),
  title: varchar("title", { length: 500 }),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  status: mysqlEnum("status", ["confirmed", "cancelled", "tentative"]).default("confirmed").notNull(),
  attendeeName: varchar("attendeeName", { length: 500 }), // Encrypted at rest (AES-256-GCM)
  attendeeEmail: varchar("attendeeEmail", { length: 500 }), // Encrypted at rest
  attendeePhone: varchar("attendeePhone", { length: 500 }), // Encrypted at rest
  leadId: int("leadId"), // Linked lead if matched
  location: text("location"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tenantIdx: index("cal_events_tenant_idx").on(t.tenantId),
  connectionIdx: index("cal_events_connection_idx").on(t.calendarConnectionId),
  externalIdx: uniqueIndex("cal_events_external_idx").on(t.calendarConnectionId, t.externalEventId),
  timeIdx: index("cal_events_time_idx").on(t.tenantId, t.startTime, t.endTime),
  statusIdx: index("cal_events_status_idx").on(t.tenantId, t.status),
  leadIdx: index("cal_events_lead_idx").on(t.leadId),
}));

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

export const calendarSyncLog = mysqlTable("calendar_sync_log", {
  id: int("id").autoincrement().primaryKey(),
  calendarConnectionId: int("calendarConnectionId").notNull().references(() => calendarConnections.id),
  syncType: mysqlEnum("syncType", ["full", "incremental"]).default("incremental").notNull(),
  status: mysqlEnum("status", ["running", "success", "failed"]).default("running").notNull(),
  eventsProcessed: int("eventsProcessed").default(0).notNull(),
  eventsCreated: int("eventsCreated").default(0).notNull(),
  eventsUpdated: int("eventsUpdated").default(0).notNull(),
  eventsCancelled: int("eventsCancelled").default(0).notNull(),
  errors: json("errors").$type<Array<{ message: string; eventId?: string }>>(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (t) => ({
  connectionIdx: index("cal_sync_log_connection_idx").on(t.calendarConnectionId),
  startedIdx: index("cal_sync_log_started_idx").on(t.startedAt),
}));

export type CalendarSyncLog = typeof calendarSyncLog.$inferSelect;

// ─── Contact Import ────────────────────────────────────────────────────────────

export const contactImports = mysqlTable("contact_imports", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  source: mysqlEnum("source", ["vcard", "google_contacts", "csv"]).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "complete", "failed"]).default("pending").notNull(),
  fileName: varchar("fileName", { length: 255 }),
  totalContacts: int("totalContacts").default(0).notNull(),
  imported: int("imported").default(0).notNull(),
  skipped: int("skipped").default(0).notNull(),
  duplicates: int("duplicates").default(0).notNull(),
  errors: json("errors").$type<Array<{ row: number; message: string }>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (t) => ({
  tenantIdx: index("contact_imports_tenant_idx").on(t.tenantId),
  statusIdx: index("contact_imports_status_idx").on(t.status),
}));

export type ContactImport = typeof contactImports.$inferSelect;
export type InsertContactImport = typeof contactImports.$inferInsert;

// ─── Lead Segments & Automation Overrides ──────────────────────────────────────

export const leadSegments = mysqlTable("lead_segments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }), // hex color for UI
  rules: json("rules").$type<{
    logic: "AND" | "OR";
    conditions: Array<{
      field: string;
      operator: string;
      value: unknown;
    }>;
  }>(),
  isAutomatic: boolean("isAutomatic").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tenantIdx: index("lead_segments_tenant_idx").on(t.tenantId),
  nameIdx: uniqueIndex("lead_segments_name_idx").on(t.tenantId, t.name),
}));

export type LeadSegment = typeof leadSegments.$inferSelect;
export type InsertLeadSegment = typeof leadSegments.$inferInsert;

export const leadSegmentMembers = mysqlTable("lead_segment_members", {
  id: int("id").autoincrement().primaryKey(),
  segmentId: int("segmentId").notNull().references(() => leadSegments.id),
  leadId: int("leadId").notNull().references(() => leads.id),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
}, (t) => ({
  segmentIdx: index("lead_seg_members_segment_idx").on(t.segmentId),
  leadIdx: index("lead_seg_members_lead_idx").on(t.leadId),
  uniqueIdx: uniqueIndex("lead_seg_members_unique_idx").on(t.segmentId, t.leadId),
}));

export type LeadSegmentMember = typeof leadSegmentMembers.$inferSelect;

export const leadAutomationOverrides = mysqlTable("lead_automation_overrides", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull().references(() => leads.id),
  automationTemplateKey: varchar("automationTemplateKey", { length: 100 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  leadIdx: index("lead_auto_overrides_lead_idx").on(t.leadId),
  uniqueIdx: uniqueIndex("lead_auto_overrides_unique_idx").on(t.leadId, t.automationTemplateKey),
}));

// ─── Deployment History (Live Update System) ─────────────────────────────────

export const deployments = mysqlTable("deployments", {
  id: int("id").autoincrement().primaryKey(),
  version: varchar("version", { length: 100 }).notNull(),
  gitHash: varchar("gitHash", { length: 40 }),
  gitBranch: varchar("gitBranch", { length: 200 }),
  status: mysqlEnum("status", ["started", "uploading", "reloading", "verified", "failed", "rolled_back"]).default("started").notNull(),
  deployedBy: varchar("deployedBy", { length: 200 }),
  durationMs: int("durationMs"),
  changelog: text("changelog"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (t) => ({
  versionIdx: index("deployments_version_idx").on(t.version),
  statusIdx: index("deployments_status_idx").on(t.status),
  createdIdx: index("deployments_created_idx").on(t.createdAt),
}));

export type Deployment = typeof deployments.$inferSelect;
export type InsertDeployment = typeof deployments.$inferInsert;

// ─── Webhook Events (audit trail) ────────────────────────────────────────────

export const webhookEvents = mysqlTable("webhook_events", {
  id: int("id").autoincrement().primaryKey(),
  stripeEventId: varchar("stripeEventId", { length: 255 }),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["processed", "failed", "skipped"]).notNull(),
  objectId: varchar("objectId", { length: 255 }),
  error: text("error"),
  payload: json("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  stripeEventIdx: index("webhook_events_stripe_event_idx").on(t.stripeEventId),
  eventTypeIdx: index("webhook_events_type_idx").on(t.eventType),
  statusIdx: index("webhook_events_status_idx").on(t.status),
  createdIdx: index("webhook_events_created_idx").on(t.createdAt),
}));

export type WebhookEventRow = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = typeof webhookEvents.$inferInsert;

// ─── Autopilot Repair Engine ──────────────────────────────────────────────────

export const repairJobs = mysqlTable("repair_jobs", {
  id: int("id").autoincrement().primaryKey(),
  errorLogId: int("errorLogId").notNull().references(() => systemErrorLogs.id),
  errorFingerprint: varchar("errorFingerprint", { length: 64 }).notNull(),
  status: mysqlEnum("status", [
    "detected", "diagnosing", "patching", "testing", "verifying",
    "deployed", "failed", "escalated",
  ]).default("detected").notNull(),
  branchName: varchar("branchName", { length: 200 }),
  errorType: varchar("errorType", { length: 50 }),
  errorMessage: text("errorMessage"),
  affectedFile: varchar("affectedFile", { length: 500 }),
  claudeOutput: text("claudeOutput"),
  diffPatch: text("diffPatch"),
  testResults: text("testResults"),
  failureReason: text("failureReason"),
  attemptCount: int("attemptCount").default(0).notNull(),
  maxAttempts: int("maxAttempts").default(3).notNull(),
  triggeredBy: mysqlEnum("triggeredBy", ["sentinel", "manual"]).default("sentinel").notNull(),
  detectedAt: timestamp("detectedAt"),
  diagnosisStartedAt: timestamp("diagnosisStartedAt"),
  patchStartedAt: timestamp("patchStartedAt"),
  testStartedAt: timestamp("testStartedAt"),
  verifyStartedAt: timestamp("verifyStartedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  errorLogIdx: index("rj_error_log_idx").on(t.errorLogId),
  fingerprintIdx: index("rj_fingerprint_idx").on(t.errorFingerprint),
  statusIdx: index("rj_status_idx").on(t.status),
  createdIdx: index("rj_created_idx").on(t.createdAt),
}));

export type RepairJob = typeof repairJobs.$inferSelect;
export type InsertRepairJob = typeof repairJobs.$inferInsert;

// ─── Sentinel Adaptive Metrics ────────────────────────────────────────────────

export const sentinelMetrics = mysqlTable("sentinel_metrics", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(0),
  category: varchar("category", { length: 50 }).notNull(),
  metric: varchar("metric", { length: 100 }).notNull(),
  value: double("value").notNull(),
  detail: json("detail").$type<Record<string, unknown>>(),
  measuredAt: timestamp("measuredAt").defaultNow().notNull(),
}, (t) => ({
  tenantCatIdx: index("idx_sm_tenant_cat").on(t.tenantId, t.category),
  measuredIdx: index("idx_sm_measured").on(t.measuredAt),
  metricIdx: index("idx_sm_metric").on(t.metric, t.measuredAt),
}));

export type SentinelMetric = typeof sentinelMetrics.$inferSelect;

export const sentinelBaselines = mysqlTable("sentinel_baselines", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(0),
  metric: varchar("metric", { length: 100 }).notNull(),
  p50: double("p50").notNull(),
  p95: double("p95").notNull(),
  sampleCount: int("sampleCount").notNull().default(0),
  computedAt: timestamp("computedAt").defaultNow().notNull(),
}, (t) => ({
  tenantMetricIdx: uniqueIndex("uq_sb_tenant_metric").on(t.tenantId, t.metric),
}));

export type SentinelBaseline = typeof sentinelBaselines.$inferSelect;

// ─── Link Tokens (Booking / Review URL Validation) ────────────────────────────

/**
 * Tracks tokens embedded in booking and review links sent via SMS.
 * Prevents forgery: tokens must exist, be unexpired, and unused to be valid.
 */
export const linkTokens = mysqlTable("link_tokens", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  leadId: int("leadId").notNull().references(() => leads.id),
  token: varchar("token", { length: 64 }).notNull().unique(),
  type: mysqlEnum("type", ["booking", "review"]).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  tokenIdx: uniqueIndex("lt_token_idx").on(t.token),
  tenantLeadIdx: index("lt_tenant_lead_idx").on(t.tenantId, t.leadId),
  expiresIdx: index("lt_expires_idx").on(t.expiresAt),
}));

export type LinkToken = typeof linkTokens.$inferSelect;
export type InsertLinkToken = typeof linkTokens.$inferInsert;
