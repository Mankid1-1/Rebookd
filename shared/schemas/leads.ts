import { z } from "zod";
import { normalizePhoneE164 } from "../phone";

// Accepts common inputs (digits, parentheses) and normalizes to E.164
export const phoneSchema = z
  .string()
  .trim()
  .superRefine((val, ctx) => {
    if (!normalizePhoneE164(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phone must be a valid number in E.164 format (e.g. +15550001234)",
      });
    }
  })
  .transform((val) => normalizePhoneE164(val)!);

// SMS body: 1–1600 chars (10 concatenated segments max)
export const smsBodySchema = z
  .string()
  .min(1, "Message cannot be empty")
  .max(1600, "Message exceeds maximum SMS length (1600 chars)");

export const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  phone: phoneSchema,
  email: z.string().email("Invalid email").max(320).optional().or(z.literal("")),
  source: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateLeadSchema = z.object({
  leadId: z.number().int().positive(),
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(320).optional().or(z.literal("")),
  phone: phoneSchema.optional(),
  notes: z.string().max(5000).optional(),
  appointmentAt: z.date().nullable().optional(),
});

export const updateLeadStatusSchema = z.object({
  leadId: z.number().int().positive(),
  status: z.enum(["new", "contacted", "qualified", "booked", "lost", "unsubscribed"]),
});

export const sendMessageSchema = z.object({
  leadId: z.number().int().positive(),
  body: smsBodySchema,
  tone: z.enum(["friendly", "professional", "casual", "urgent", "empathetic"]).optional(),
  // Idempotency key — client generates a UUID per send attempt to prevent duplicates
  idempotencyKey: z.string().uuid("idempotencyKey must be a UUID").optional(),
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
