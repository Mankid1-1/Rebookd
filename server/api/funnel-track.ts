/**
 * Funnel Event Beacon Endpoint
 *
 * Receives fire-and-forget event data from the client via navigator.sendBeacon.
 * Inserts into funnel_events table for the admin funnel analytics dashboard.
 */

import type { Express } from "express";
import { getDb } from "../db";
import { logger } from "../_core/logger";

export function registerFunnelTrackEndpoint(app: Express): void {
  app.post("/api/funnel/track", async (req, res) => {
    try {
      const {
        event,
        properties,
        sessionId,
        attribution,
        pageUrl,
      } = req.body || {};

      if (!event || !sessionId) {
        res.status(400).json({ ok: false });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ ok: false });
        return;
      }

      await db.execute({
        sql: `INSERT INTO funnel_events
          (sessionId, eventName, properties, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, referrer, pageUrl)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          String(sessionId).slice(0, 64),
          String(event).slice(0, 100),
          properties ? JSON.stringify(properties) : null,
          attribution?.utm_source || null,
          attribution?.utm_medium || null,
          attribution?.utm_campaign || null,
          attribution?.utm_content || null,
          attribution?.utm_term || null,
          attribution?.referrer || null,
          pageUrl ? String(pageUrl).slice(0, 2048) : null,
        ],
      });

      res.json({ ok: true });
    } catch (err) {
      logger.error("Failed to track funnel event", { error: String(err) });
      // Always return 200 for beacons — client doesn't care about errors
      res.json({ ok: false });
    }
  });
}
