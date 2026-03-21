/**
 * Twilio Inbound SMS Webhook
 * POST /api/twilio/inbound
 *
 * Twilio calls this URL when a message is received on any of your numbers.
 * Configure this in Twilio Console → Phone Numbers → Messaging → Webhook URL.
 *
 * Handles:
 * - STOP / UNSUBSCRIBE / QUIT / CANCEL / END keywords → marks lead as unsubscribed (TCPA compliance)
 * - START / YES / UNSTOP → re-subscribes lead
 * - All other messages → stores as inbound message, updates lead lastInboundAt
 */

import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { leads, messages, phoneNumbers } from "../../drizzle/schema";
import { emitEvent } from "../services/eventBus";

const STOP_KEYWORDS = new Set(["stop", "unsubscribe", "quit", "cancel", "end", "stopall"]);
const START_KEYWORDS = new Set(["start", "yes", "unstop"]);

export function registerTwilioWebhook(app: Express) {
  app.post("/api/twilio/inbound", async (req: Request, res: Response) => {
    // Respond immediately with empty TwiML so Twilio doesn't retry
    res.set("Content-Type", "text/xml");
    res.send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>");

    try {
      const { From, To, Body } = req.body as { From?: string; To?: string; Body?: string };

      if (!From || !Body) return;

      const db = await getDb();
      if (!db) return;

      const bodyLower = Body.trim().toLowerCase().replace(/[^a-z]/g, "");

      // Find which tenant owns the 'To' number
      let tenantId: number | undefined;
      if (To) {
        const numRow = await db
          .select({ tenantId: phoneNumbers.tenantId })
          .from(phoneNumbers)
          .where(eq(phoneNumbers.number, To))
          .limit(1);
        tenantId = numRow[0]?.tenantId;
      }

      if (!tenantId) {
        console.warn(`[Twilio] Received message for unknown number: ${To}`);
        return;
      }

      // Find the lead by phone number
      const leadRows = await db
        .select()
        .from(leads)
        .where(and(eq(leads.tenantId, tenantId), eq(leads.phone, From)))
        .limit(1);

      let lead = leadRows[0];

      // Create lead if they texted in but don't exist yet
      if (!lead) {
        const result = await db.insert(leads).values({
          tenantId,
          phone: From,
          status: "new",
          lastInboundAt: new Date(),
          lastMessageAt: new Date(),
        });
        const newLeadRows = await db
          .select()
          .from(leads)
          .where(and(eq(leads.tenantId, tenantId), eq(leads.phone, From)))
          .limit(1);
        lead = newLeadRows[0];
        if (!lead) return;
      }

      // ── STOP / UNSUBSCRIBE compliance (TCPA required) ────────────────────────
      if (STOP_KEYWORDS.has(bodyLower)) {
        await db
          .update(leads)
          .set({ status: "unsubscribed", updatedAt: new Date(), lastInboundAt: new Date() })
          .where(eq(leads.id, lead.id));

        // Log the inbound STOP message
        await db.insert(messages).values({
          tenantId,
          leadId: lead.id,
          direction: "inbound",
          body: Body,
          fromNumber: From,
          toNumber: To,
          status: "received",
        });

        console.log(`[Twilio] STOP received from ${From} — lead #${lead.id} unsubscribed`);
        return;
      }

      // ── START / YES (re-subscribe) ────────────────────────────────────────────
      if (START_KEYWORDS.has(bodyLower) && lead.status === "unsubscribed") {
        await db
          .update(leads)
          .set({ status: "new", updatedAt: new Date(), lastInboundAt: new Date() })
          .where(eq(leads.id, lead.id));

        console.log(`[Twilio] START received from ${From} — lead #${lead.id} re-subscribed`);
      }

      // ── Store inbound message ─────────────────────────────────────────────────
      await db.insert(messages).values({
        tenantId,
        leadId: lead.id,
        direction: "inbound",
        body: Body,
        fromNumber: From,
        toNumber: To,
        status: "received",
      });

      // Update lead lastInboundAt and lastMessageAt
      await db
        .update(leads)
        .set({ lastInboundAt: new Date(), lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(leads.id, lead.id));

      await emitEvent({
        type: "message.received",
        data: { leadId: lead.id, body: Body, from: From, to: To },
        tenantId,
        userId: undefined,
        timestamp: new Date(),
      });

      console.log(`[Twilio] Inbound from ${From}: "${Body.slice(0, 50)}"`);

    } catch (err) {
      console.error("[Twilio] Webhook error:", err);
    }
  });
}
