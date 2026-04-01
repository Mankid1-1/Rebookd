/**
 * Calendar Integration Router
 *
 * tRPC procedures for managing calendar connections, triggering syncs,
 * and querying calendar events.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../_core/trpc";
import * as CalendarSyncService from "../services/calendar/calendar-sync.service";
import { randomUUID } from "crypto";

// In-memory OAuth state store (short-lived) — exported for Express callback route
export const oauthStates = new Map<string, { tenantId: number; provider: string; expiresAt: number; returnTo?: string }>();

export const calendarRouter = router({
  /** List all calendar connections for the current tenant */
  listConnections: tenantProcedure.query(async ({ ctx }) => {
    return CalendarSyncService.listConnections(ctx.db, ctx.tenantId);
  }),

  /** Start OAuth flow for a calendar provider */
  initiateConnect: tenantProcedure
    .input(z.object({
      provider: z.enum(["google", "outlook", "caldav", "calendly", "acuity"]),
      returnTo: z.string().optional(),
      credentials: z.object({
        username: z.string().optional(),
        appPassword: z.string().optional(),
        userId: z.string().optional(),
        apiKey: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const provider = CalendarSyncService.getProvider(input.provider);

      // For CalDAV and Acuity, handle direct credentials
      if (input.provider === "caldav" || input.provider === "acuity") {
        if (!input.credentials) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Credentials required for this provider" });
        }

        const credJson = JSON.stringify(input.credentials);
        const authResult = await provider.handleCallback(credJson);
        await CalendarSyncService.saveConnection(ctx.db, ctx.tenantId, {
          provider: input.provider,
          ...authResult,
        });

        return { success: true, authUrl: null };
      }

      // For OAuth providers, generate state and return auth URL
      const state = randomUUID();
      oauthStates.set(state, {
        tenantId: ctx.tenantId,
        provider: input.provider,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
        returnTo: input.returnTo,
      });

      const authUrl = provider.getAuthUrl(state);
      return { success: true, authUrl };
    }),

  /** Handle OAuth callback */
  handleCallback: tenantProcedure
    .input(z.object({
      code: z.string(),
      state: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const stateData = oauthStates.get(input.state);
      if (!stateData || stateData.expiresAt < Date.now()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired OAuth state" });
      }

      if (stateData.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "OAuth state mismatch" });
      }

      oauthStates.delete(input.state);

      const provider = CalendarSyncService.getProvider(stateData.provider);
      const authResult = await provider.handleCallback(input.code);

      await CalendarSyncService.saveConnection(ctx.db, ctx.tenantId, {
        provider: stateData.provider as "google" | "outlook" | "caldav" | "calendly" | "acuity",
        ...authResult,
      });

      // Trigger initial sync
      const connections = await CalendarSyncService.listConnections(ctx.db, ctx.tenantId);
      const newest = connections[connections.length - 1];
      if (newest) {
        CalendarSyncService.syncCalendar(ctx.db, newest.id).catch(() => {});
      }

      return { success: true, label: authResult.label };
    }),

  /** Disconnect a calendar */
  disconnect: tenantProcedure
    .input(z.object({ connectionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await CalendarSyncService.disconnectCalendar(ctx.db, ctx.tenantId, input.connectionId);
      return { success: true };
    }),

  /** Trigger manual sync for a connection */
  syncNow: tenantProcedure
    .input(z.object({ connectionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Verify the connection belongs to this tenant before syncing
      const connections = await CalendarSyncService.listConnections(ctx.db, ctx.tenantId);
      const owned = connections.some((c: { id: number }) => c.id === input.connectionId);
      if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Calendar connection not found" });
      const result = await CalendarSyncService.syncCalendar(ctx.db, input.connectionId);
      return result;
    }),

  /** Get sync history for a connection */
  getSyncHistory: tenantProcedure
    .input(z.object({ connectionId: z.number(), limit: z.number().default(20) }))
    .query(async ({ input, ctx }) => {
      // Verify the connection belongs to this tenant
      const connections = await CalendarSyncService.listConnections(ctx.db, ctx.tenantId);
      const owned = connections.some((c: { id: number }) => c.id === input.connectionId);
      if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Calendar connection not found" });
      return CalendarSyncService.getSyncHistory(ctx.db, input.connectionId, input.limit);
    }),

  /** Get calendar events for the tenant */
  getEvents: tenantProcedure
    .input(z.object({
      start: z.string().transform((s) => new Date(s)),
      end: z.string().transform((s) => new Date(s)),
    }))
    .query(async ({ input, ctx }) => {
      return CalendarSyncService.getCalendarEvents(ctx.db, ctx.tenantId, input.start, input.end);
    }),

  /** Get scheduling gaps from calendar data */
  getGaps: tenantProcedure
    .input(z.object({
      start: z.string().transform((s) => new Date(s)),
      end: z.string().transform((s) => new Date(s)),
      gapThresholdMinutes: z.number().default(30),
    }))
    .query(async ({ input, ctx }) => {
      return CalendarSyncService.getCalendarGaps(
        ctx.db,
        ctx.tenantId,
        input.start,
        input.end,
        input.gapThresholdMinutes
      );
    }),
});
