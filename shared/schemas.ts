/**
 * 📋 SHARED SCHEMAS
 * Common validation schemas used across server and client
 */

import { z } from "zod";

// Lead schemas
export const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "booked", "lost", "unsubscribed"]).default("new"),
  tenantId: z.number(),
});

export const updateLeadSchema = z.object({
  leadId: z.number(),
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "booked", "lost", "unsubscribed"]).optional(),
});

export const updateLeadStatusSchema = z.object({
  leadId: z.number(),
  status: z.enum(["new", "contacted", "qualified", "booked", "lost", "unsubscribed"]),
  notes: z.string().optional(),
});

export const sendMessageSchema = z.object({
  leadId: z.number(),
  body: z.string().min(1, "Message is required"),
  tone: z.enum(["friendly", "professional", "casual", "urgent", "empathetic"]).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Pagination schemas
export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

// User schemas
export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

// Tenant schemas
export const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  settings: z.record(z.string(), z.any()).optional(),
});

// Template schemas
export const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  content: z.string().min(1, "Content is required"),
  type: z.enum(["sms", "email"]),
  category: z.string().optional(),
  variables: z.array(z.string()).optional(),
});

export const updateTemplateSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(["sms", "email"]).optional(),
  category: z.string().optional(),
  variables: z.array(z.string()).optional(),
});

// Automation schemas
export const createAutomationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  trigger: z.object({
    type: z.string(),
    conditions: z.record(z.string(), z.any()),
  }),
  actions: z.array(z.object({
    type: z.string(),
    config: z.record(z.string(), z.any()),
  })),
  isActive: z.boolean().default(true),
});

export const updateAutomationSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  trigger: z.object({
    type: z.string(),
    conditions: z.record(z.string(), z.any()),
  }).optional(),
  actions: z.array(z.object({
    type: z.string(),
    config: z.record(z.string(), z.any()),
  })).optional(),
  isActive: z.boolean().optional(),
});

// Referral schemas
export const generateReferralCodeSchema = z.object({
  userId: z.number(),
});

export const processReferralSchema = z.object({
  referralCode: z.string().min(1),
  referredUserId: z.number(),
});

export const completeReferralSchema = z.object({
  referralId: z.string(),
  subscriptionId: z.string(),
  subscriptionMonths: z.number().min(6),
});

// Stripe schemas
export const createCheckoutSessionSchema = z.object({
  customerEmail: z.string().email(),
  userId: z.string(),
  tenantId: z.string(),
  referralCode: z.string().optional(),
});

export const reportUsageSchema = z.object({
  customerId: z.string(),
  recoveredAmount: z.number().min(0),
});

// Customer portal schemas
export const createPortalSessionSchema = z.object({
  customerId: z.string(),
  returnUrl: z.string().optional(),
});

export const getSubscriptionDetailsSchema = z.object({
  customerId: z.string(),
});

// Analytics schemas
export const getDashboardMetricsSchema = z.object({
  tenantId: z.number().optional(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
});

export const getRevenueRecoveryMetricsSchema = z.object({
  tenantId: z.number().optional(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
});

// System schemas
export const healthCheckSchema = z.object({});

export const systemInfoSchema = z.object({});

// Export all schemas
export const schemas = {
  createLeadSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  sendMessageSchema,
  loginSchema,
  paginationSchema,
  updateProfileSchema,
  updateTenantSchema,
  createTemplateSchema,
  updateTemplateSchema,
  createAutomationSchema,
  updateAutomationSchema,
  generateReferralCodeSchema,
  processReferralSchema,
  completeReferralSchema,
  createCheckoutSessionSchema,
  reportUsageSchema,
  createPortalSessionSchema,
  getSubscriptionDetailsSchema,
  getDashboardMetricsSchema,
  getRevenueRecoveryMetricsSchema,
  healthCheckSchema,
  systemInfoSchema,
};
