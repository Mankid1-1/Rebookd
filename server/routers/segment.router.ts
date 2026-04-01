/**
 * Segment & Bulk Operations Router
 *
 * tRPC procedures for lead segments, bulk operations,
 * and automation override management.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../_core/trpc";
import * as SegmentService from "../services/segment.service";
import {
  leadAutomationOverrides,
  leads,
} from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { PRESET_CONDITION_BUNDLES } from "../services/conditions-engine.service";

const conditionSchema: z.ZodType<any> = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.any(),
});

const conditionGroupSchema: z.ZodType<any> = z.object({
  logic: z.enum(["AND", "OR"]),
  conditions: z.array(z.union([conditionSchema, z.lazy(() => conditionGroupSchema)])),
});

export const segmentRouter = router({
  // ─── Segments ──────────────────────────────────────────────────────────────

  list: tenantProcedure.query(async ({ ctx }) => {
    return SegmentService.listSegments(ctx.db, ctx.tenantId);
  }),

  get: tenantProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const segment = await SegmentService.getSegment(ctx.db, ctx.tenantId, input.id);
      if (!segment) throw new TRPCError({ code: "NOT_FOUND" });
      return segment;
    }),

  create: tenantProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      rules: conditionGroupSchema.optional(),
      isAutomatic: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      return SegmentService.createSegment(ctx.db, ctx.tenantId, input);
    }),

  update: tenantProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      rules: conditionGroupSchema.optional(),
      isAutomatic: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await SegmentService.updateSegment(ctx.db, ctx.tenantId, id, data);
      return { success: true };
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await SegmentService.deleteSegment(ctx.db, ctx.tenantId, input.id);
      return { success: true };
    }),

  getLeads: tenantProcedure
    .input(z.object({
      segmentId: z.number(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      return SegmentService.getLeadsInSegment(ctx.db, input.segmentId, input.limit, input.offset);
    }),

  addLeads: tenantProcedure
    .input(z.object({
      segmentId: z.number(),
      leadIds: z.array(z.number()),
    }))
    .mutation(async ({ input, ctx }) => {
      await SegmentService.addToSegment(ctx.db, input.segmentId, input.leadIds);
      return { success: true };
    }),

  removeLeads: tenantProcedure
    .input(z.object({
      segmentId: z.number(),
      leadIds: z.array(z.number()),
    }))
    .mutation(async ({ input, ctx }) => {
      await SegmentService.removeFromSegment(ctx.db, input.segmentId, input.leadIds);
      return { success: true };
    }),

  reevaluate: tenantProcedure
    .input(z.object({ segmentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const segment = await SegmentService.getSegment(ctx.db, ctx.tenantId, input.segmentId);
      if (!segment) throw new TRPCError({ code: "NOT_FOUND" });
      if (!segment.isAutomatic) throw new TRPCError({ code: "BAD_REQUEST", message: "Only automatic segments can be re-evaluated" });
      const result = await SegmentService.evaluateAutomaticSegment(
        ctx.db,
        ctx.tenantId,
        input.segmentId,
        segment.rules as any
      );
      return result;
    }),

  // ─── Preset Bundles ────────────────────────────────────────────────────────

  getPresets: tenantProcedure.query(() => {
    return Object.entries(PRESET_CONDITION_BUNDLES).map(([key, bundle]) => ({
      key,
      name: bundle.name,
      description: bundle.description,
    }));
  }),

  // ─── Bulk Operations ──────────────────────────────────────────────────────

  bulkUpdateStatus: tenantProcedure
    .input(z.object({
      leadIds: z.array(z.number()).max(500),
      status: z.enum(["new", "contacted", "qualified", "booked", "lost", "unsubscribed"]),
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .update(leads)
        .set({ status: input.status })
        .where(
          and(
            eq(leads.tenantId, ctx.tenantId),
            inArray(leads.id, input.leadIds)
          )
        );
      return { success: true, updated: input.leadIds.length };
    }),

  bulkAssignSegment: tenantProcedure
    .input(z.object({
      leadIds: z.array(z.number()).max(500),
      segmentId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await SegmentService.addToSegment(ctx.db, input.segmentId, input.leadIds);
      return { success: true };
    }),

  // ─── Automation Overrides ──────────────────────────────────────────────────

  setAutomationOverride: tenantProcedure
    .input(z.object({
      leadId: z.number(),
      automationTemplateKey: z.string(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify lead belongs to tenant
      const [lead] = await ctx.db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, ctx.tenantId)))
        .limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

      // Upsert override
      try {
        await ctx.db.insert(leadAutomationOverrides).values({
          leadId: input.leadId,
          automationTemplateKey: input.automationTemplateKey,
          enabled: input.enabled,
        });
      } catch {
        // Duplicate — update
        await ctx.db
          .update(leadAutomationOverrides)
          .set({ enabled: input.enabled })
          .where(
            and(
              eq(leadAutomationOverrides.leadId, input.leadId),
              eq(leadAutomationOverrides.automationTemplateKey, input.automationTemplateKey)
            )
          );
      }

      return { success: true };
    }),

  removeAutomationOverride: tenantProcedure
    .input(z.object({
      leadId: z.number(),
      automationTemplateKey: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .delete(leadAutomationOverrides)
        .where(
          and(
            eq(leadAutomationOverrides.leadId, input.leadId),
            eq(leadAutomationOverrides.automationTemplateKey, input.automationTemplateKey)
          )
        );
      return { success: true };
    }),

  getLeadOverrides: tenantProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input, ctx }) => {
      return ctx.db
        .select()
        .from(leadAutomationOverrides)
        .where(eq(leadAutomationOverrides.leadId, input.leadId));
    }),
});
