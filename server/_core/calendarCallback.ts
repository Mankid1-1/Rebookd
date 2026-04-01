/**
 * Express route for handling OAuth calendar callbacks.
 *
 * Google/Outlook/Calendly redirect the user's browser to
 *   /api/calendar/:provider/callback?code=...&state=...
 * as a plain GET — this can't go through tRPC (no auth context).
 * We validate the state token, exchange the code for tokens,
 * persist the connection, and redirect back to the app.
 */

import type { Express } from "express";
import { oauthStates } from "../routers/calendar.router";
import * as CalendarSyncService from "../services/calendar/calendar-sync.service";
import { getDb } from "../db";
import { logger } from "./logger";

export function registerCalendarCallbacks(app: Express) {
  app.get("/api/calendar/:provider/callback", async (req, res) => {
    const { provider } = req.params;
    const { code, state, error } = req.query as Record<string, string>;

    // Peek at state early to determine the returnTo redirect target
    const peekState = state ? oauthStates.get(state as string) : undefined;
    const basePath = peekState?.returnTo || "/calendar-integration";

    // User denied consent
    if (error) {
      logger.warn("Calendar OAuth denied by user", { provider, error });
      return res.redirect(`${basePath}?error=denied`);
    }

    if (!code || !state) {
      logger.warn("Calendar callback missing code or state", { provider });
      return res.redirect(`${basePath}?error=missing_params`);
    }

    // Validate state token
    const stateData = oauthStates.get(state);
    if (!stateData || stateData.expiresAt < Date.now()) {
      logger.warn("Calendar callback invalid or expired state", { provider, state });
      oauthStates.delete(state);
      return res.redirect(`${basePath}?error=expired`);
    }

    if (stateData.provider !== provider) {
      logger.warn("Calendar callback provider mismatch", { expected: stateData.provider, got: provider });
      oauthStates.delete(state);
      return res.redirect(`${basePath}?error=provider_mismatch`);
    }

    const returnTo = stateData.returnTo || "/calendar-integration";
    oauthStates.delete(state);

    try {
      const db = await getDb();
      const calProvider = CalendarSyncService.getProvider(provider);
      const authResult = await calProvider.handleCallback(code);

      await CalendarSyncService.saveConnection(db, stateData.tenantId, {
        provider: provider as "google" | "outlook" | "caldav" | "calendly" | "acuity",
        ...authResult,
      });

      // Trigger initial sync in background
      const connections = await CalendarSyncService.listConnections(db, stateData.tenantId);
      const newest = connections[connections.length - 1];
      if (newest) {
        CalendarSyncService.syncCalendar(db, newest.id).catch((err) => {
          logger.error("Initial calendar sync failed", { error: String(err), connectionId: newest.id });
        });
      }

      logger.info("Calendar connected successfully", { provider, tenantId: stateData.tenantId, label: authResult.label });
      return res.redirect(`${returnTo}?connected=true`);
    } catch (err) {
      logger.error("Calendar OAuth callback failed", { provider, error: String(err) });
      return res.redirect(`${returnTo}?error=token_exchange_failed`);
    }
  });
}
