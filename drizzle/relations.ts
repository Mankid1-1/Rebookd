import { relations } from "drizzle-orm";
import {
  users,
  tenants,
  emailVerificationTokens,
  passwordResetTokens,
  plans,
  subscriptions,
  billingInvoices,
  billingRefunds,
  usage,
  phoneNumbers,
  leads,
  messages,
  templates,
  automations,
  automationJobs,
  aiMessageLogs,
  webhookLogs,
  apiKeys,
  systemErrorLogs,
  adminAuditLogs,
  smsRateLimits,
  webhookReceiveDedupes,
  referrals,
  referralPayouts,
  stripeSubscriptions,
} from "./schema";

// ─── Tenants ──────────────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  subscriptions: many(subscriptions),
  billingInvoices: many(billingInvoices),
  billingRefunds: many(billingRefunds),
  usage: many(usage),
  phoneNumbers: many(phoneNumbers),
  leads: many(leads),
  messages: many(messages),
  templates: many(templates),
  automations: many(automations),
  automationJobs: many(automationJobs),
  aiMessageLogs: many(aiMessageLogs),
  webhookLogs: many(webhookLogs),
  apiKeys: many(apiKeys),
  systemErrorLogs: many(systemErrorLogs),
  smsRateLimits: many(smsRateLimits),
  webhookReceiveDedupes: many(webhookReceiveDedupes),
  stripeSubscriptions: many(stripeSubscriptions),
}));

// ─── Users ────────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  emailVerificationTokens: many(emailVerificationTokens),
  passwordResetTokens: many(passwordResetTokens),
  referralsMade: many(referrals, { relationName: "referrer" }),
  referralsReceived: many(referrals, { relationName: "referredUser" }),
  referralPayouts: many(referralPayouts),
  stripeSubscriptions: many(stripeSubscriptions),
}));

// ─── Email Verification Tokens ───────────────────────────────────────────────

export const emailVerificationTokensRelations = relations(
  emailVerificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerificationTokens.userId],
      references: [users.id],
    }),
  }),
);

// ─── Password Reset Tokens ──────────────────────────────────────────────────

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

// ─── Plans ───────────────────────────────────────────────────────────────────

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

// ─── Subscriptions ──────────────────────────────────────────────────────────

export const subscriptionsRelations = relations(
  subscriptions,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [subscriptions.tenantId],
      references: [tenants.id],
    }),
    plan: one(plans, {
      fields: [subscriptions.planId],
      references: [plans.id],
    }),
    billingInvoices: many(billingInvoices),
    billingRefunds: many(billingRefunds),
  }),
);

// ─── Billing Invoices ───────────────────────────────────────────────────────

export const billingInvoicesRelations = relations(
  billingInvoices,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [billingInvoices.tenantId],
      references: [tenants.id],
    }),
    subscription: one(subscriptions, {
      fields: [billingInvoices.subscriptionId],
      references: [subscriptions.id],
    }),
    refunds: many(billingRefunds),
  }),
);

// ─── Billing Refunds ────────────────────────────────────────────────────────

export const billingRefundsRelations = relations(billingRefunds, ({ one }) => ({
  tenant: one(tenants, {
    fields: [billingRefunds.tenantId],
    references: [tenants.id],
  }),
  subscription: one(subscriptions, {
    fields: [billingRefunds.subscriptionId],
    references: [subscriptions.id],
  }),
  invoice: one(billingInvoices, {
    fields: [billingRefunds.billingInvoiceId],
    references: [billingInvoices.id],
  }),
}));

// ─── Usage ──────────────────────────────────────────────────────────────────

export const usageRelations = relations(usage, ({ one }) => ({
  tenant: one(tenants, {
    fields: [usage.tenantId],
    references: [tenants.id],
  }),
}));

// ─── Phone Numbers ──────────────────────────────────────────────────────────

export const phoneNumbersRelations = relations(phoneNumbers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [phoneNumbers.tenantId],
    references: [tenants.id],
  }),
}));

// ─── Leads ──────────────────────────────────────────────────────────────────

export const leadsRelations = relations(leads, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [leads.tenantId],
    references: [tenants.id],
  }),
  messages: many(messages),
  automationJobs: many(automationJobs),
  aiMessageLogs: many(aiMessageLogs),
}));

// ─── Messages ───────────────────────────────────────────────────────────────

export const messagesRelations = relations(messages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [messages.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [messages.leadId],
    references: [leads.id],
  }),
  automation: one(automations, {
    fields: [messages.automationId],
    references: [automations.id],
  }),
}));

// ─── Templates ──────────────────────────────────────────────────────────────

export const templatesRelations = relations(templates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [templates.tenantId],
    references: [tenants.id],
  }),
}));

// ─── Automations ────────────────────────────────────────────────────────────

export const automationsRelations = relations(
  automations,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [automations.tenantId],
      references: [tenants.id],
    }),
    jobs: many(automationJobs),
    messages: many(messages),
  }),
);

// ─── Automation Jobs ────────────────────────────────────────────────────────

export const automationJobsRelations = relations(
  automationJobs,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [automationJobs.tenantId],
      references: [tenants.id],
    }),
    automation: one(automations, {
      fields: [automationJobs.automationId],
      references: [automations.id],
    }),
    lead: one(leads, {
      fields: [automationJobs.leadId],
      references: [leads.id],
    }),
  }),
);

// ─── AI Message Logs ────────────────────────────────────────────────────────

export const aiMessageLogsRelations = relations(aiMessageLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiMessageLogs.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [aiMessageLogs.leadId],
    references: [leads.id],
  }),
}));

// ─── Webhook Logs ───────────────────────────────────────────────────────────

export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [webhookLogs.tenantId],
    references: [tenants.id],
  }),
}));

// ─── API Keys ───────────────────────────────────────────────────────────────

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  tenant: one(tenants, {
    fields: [apiKeys.tenantId],
    references: [tenants.id],
  }),
}));

// ─── System Error Logs ──────────────────────────────────────────────────────

export const systemErrorLogsRelations = relations(
  systemErrorLogs,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [systemErrorLogs.tenantId],
      references: [tenants.id],
    }),
  }),
);

// ─── Admin Audit Logs ───────────────────────────────────────────────────────

export const adminAuditLogsRelations = relations(
  adminAuditLogs,
  ({ one }) => ({
    adminUser: one(users, {
      fields: [adminAuditLogs.adminUserId],
      references: [users.id],
      relationName: "adminAuditAdmin",
    }),
    targetTenant: one(tenants, {
      fields: [adminAuditLogs.targetTenantId],
      references: [tenants.id],
    }),
    targetUser: one(users, {
      fields: [adminAuditLogs.targetUserId],
      references: [users.id],
      relationName: "adminAuditTarget",
    }),
  }),
);

// ─── SMS Rate Limits ────────────────────────────────────────────────────────

export const smsRateLimitsRelations = relations(smsRateLimits, ({ one }) => ({
  tenant: one(tenants, {
    fields: [smsRateLimits.tenantId],
    references: [tenants.id],
  }),
}));

// ─── Webhook Receive Dedupes ────────────────────────────────────────────────

export const webhookReceiveDedupesRelations = relations(
  webhookReceiveDedupes,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [webhookReceiveDedupes.tenantId],
      references: [tenants.id],
    }),
  }),
);

// ─── Referrals ──────────────────────────────────────────────────────────────

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.id],
    relationName: "referrer",
  }),
  referredUser: one(users, {
    fields: [referrals.referredUserId],
    references: [users.id],
    relationName: "referredUser",
  }),
}));

// ─── Referral Payouts ───────────────────────────────────────────────────────

export const referralPayoutsRelations = relations(
  referralPayouts,
  ({ one }) => ({
    user: one(users, {
      fields: [referralPayouts.userId],
      references: [users.id],
    }),
  }),
);

// ─── Stripe Subscriptions ───────────────────────────────────────────────────

export const stripeSubscriptionsRelations = relations(
  stripeSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [stripeSubscriptions.userId],
      references: [users.id],
    }),
    tenant: one(tenants, {
      fields: [stripeSubscriptions.tenantId],
      references: [tenants.id],
    }),
  }),
);
