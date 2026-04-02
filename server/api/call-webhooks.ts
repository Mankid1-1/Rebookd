/**
 * 📞 VOICE CALL WEBHOOKS
 * Express endpoints for Twilio Voice, Telnyx Voice, and generic VoIP providers.
 * These are raw Express routes (not tRPC) because voice providers POST form-encoded or JSON data directly.
 */

import type { Express, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { getDb } from "../db";
import { phoneNumbers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import * as CallTrackingService from "../services/call-tracking.service";
import type { CallStatus } from "../services/call-tracking.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRawBody(req: Request): string {
  return String((req as any).rawBody || "");
}

function verifyTwilioVoiceSignature(req: Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return process.env.NODE_ENV !== "production";

  const twilioSignature = req.headers["x-twilio-signature"] as string;
  if (!twilioSignature) return false;

  const params = req.body ?? {};
  const sortedKeys = Object.keys(params).sort();
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const str = url + sortedKeys.map((key) => key + params[key]).join("");
  const expected = createHmac("sha1", authToken).update(str).digest("base64");

  try {
    return timingSafeEqual(Buffer.from(twilioSignature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function verifyTelnyxVoiceSignature(req: Request): boolean {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  if (!publicKey) return process.env.NODE_ENV !== "production";

  const signature = req.headers["telnyx-signature-ed25519"] as string;
  const timestamp = req.headers["telnyx-timestamp"] as string;
  if (!signature || !timestamp) return false;

  const ts = parseInt(timestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const payload = `${timestamp}|${getRawBody(req) || JSON.stringify(req.body)}`;
  const expected = createHmac("sha256", publicKey).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/** Resolve tenant and forwarding info from a phone number we own */
async function resolveTenantByPhone(phoneNumber: string): Promise<{ tenantId: number; forwardTo: string | null } | null> {
  const db = await getDb();
  const clean = phoneNumber.replace(/[^+\d]/g, "");
  const [row] = await db
    .select({ tenantId: phoneNumbers.tenantId, forwardTo: phoneNumbers.forwardTo })
    .from(phoneNumbers)
    .where(eq(phoneNumbers.number, clean))
    .limit(1);
  return row ? { tenantId: row.tenantId, forwardTo: row.forwardTo } : null;
}

/** Map Twilio CallStatus to our enum */
function mapTwilioStatus(twilioStatus: string): CallStatus {
  const map: Record<string, CallStatus> = {
    initiated: "ringing",
    ringing: "ringing",
    "in-progress": "in_progress",
    completed: "completed",
    busy: "busy",
    "no-answer": "no_answer",
    canceled: "missed",
    failed: "failed",
  };
  return map[twilioStatus] ?? "failed";
}

/** Map Telnyx event_type to our status */
function mapTelnyxEvent(eventType: string): CallStatus | null {
  const map: Record<string, CallStatus> = {
    "call.initiated": "ringing",
    "call.answered": "in_progress",
    "call.hangup": "completed",
    "call.machine.detection.ended": "voicemail",
  };
  return map[eventType] ?? null;
}

// ─── Route Registration ──────────────────────────────────────────────────────

export function registerCallWebhooks(app: Express) {
  /**
   * Twilio Voice Webhook
   * Receives form-encoded POST with CallSid, CallStatus, From, To, Direction, CallDuration, etc.
   * MUST return TwiML XML (not JSON).
   */
  app.post("/api/webhooks/voice/twilio", async (req: Request, res: Response) => {
    try {
      if (!verifyTwilioVoiceSignature(req)) {
        console.warn("[Voice/Twilio] Signature verification failed");
        return res.status(403).type("text/xml").send("<Response><Say>Unauthorized</Say></Response>");
      }

      const { CallSid, CallStatus, From, To, Direction, CallDuration, RecordingUrl } = req.body;
      if (!CallSid || !From || !To) {
        return res.status(400).type("text/xml").send("<Response/>");
      }

      // Determine which number is ours for tenant lookup
      const ourNumber = Direction === "outbound-api" || Direction === "outbound-dial" ? From : To;
      const resolved = await resolveTenantByPhone(ourNumber);

      if (!resolved) {
        console.warn("[Voice/Twilio] No tenant found for number:", ourNumber);
        return res.status(200).type("text/xml").send("<Response/>");
      }

      const { tenantId, forwardTo } = resolved;
      const db = await getDb();
      const status = mapTwilioStatus(CallStatus);
      const isOutbound = Direction?.startsWith("outbound");

      // Try update first (subsequent event for same call), then insert
      const updated = await CallTrackingService.updateCallStatus(db, tenantId, CallSid, {
        status,
        duration: CallDuration ? parseInt(CallDuration) : undefined,
        endedAt: status === "completed" || status === "failed" || status === "busy" || status === "no_answer" ? new Date() : undefined,
        answeredAt: status === "in_progress" ? new Date() : undefined,
        recordingUrl: RecordingUrl ?? undefined,
      });

      if (!updated) {
        // First event for this call — create new record
        await CallTrackingService.logCall(db, {
          tenantId,
          direction: isOutbound ? "outbound" : "inbound",
          callerNumber: From,
          calledNumber: To,
          status,
          duration: CallDuration ? parseInt(CallDuration) : 0,
          startedAt: new Date(),
          provider: "twilio",
          providerCallSid: CallSid,
          recordingUrl: RecordingUrl,
        });
      }

      // For inbound calls on a tracking number: forward to the business phone
      // Only forward on initial call event (ringing/initiated), not status callbacks
      if (!isOutbound && forwardTo && (CallStatus === "ringing" || CallStatus === "initiated" || !CallStatus)) {
        return res.status(200).type("text/xml").send(
          `<Response><Dial callerId="${To}" timeout="30" action="${ENV.backendUrl || ""}/api/webhooks/voice/twilio">${forwardTo}</Dial></Response>`
        );
      }

      // Return empty TwiML for status callbacks and outbound calls
      res.status(200).type("text/xml").send("<Response/>");
    } catch (error) {
      console.error("[Voice/Twilio] Webhook error:", error);
      res.status(200).type("text/xml").send("<Response/>");
    }
  });

  /**
   * Telnyx Voice Webhook
   * Receives JSON with { data: { event_type, payload } }
   */
  app.post("/api/webhooks/voice/telnyx", async (req: Request, res: Response) => {
    try {
      if (!verifyTelnyxVoiceSignature(req)) {
        console.warn("[Voice/Telnyx] Signature verification failed");
        return res.status(403).json({ error: "Unauthorized" });
      }

      const eventType = req.body?.data?.event_type;
      const payload = req.body?.data?.payload;
      if (!eventType || !payload) {
        return res.status(400).json({ error: "Missing event data" });
      }

      const status = mapTelnyxEvent(eventType);
      if (!status) {
        // Unhandled event type — acknowledge but ignore
        return res.status(200).json({ success: true });
      }

      const callSid = payload.call_control_id || payload.call_session_id;
      const from = payload.from ?? "";
      const to = payload.to ?? "";
      const direction = payload.direction === "outgoing" ? "outbound" : "inbound";

      const ourNumber = direction === "inbound" ? to : from;
      const resolved = await resolveTenantByPhone(ourNumber);

      if (!resolved) {
        console.warn("[Voice/Telnyx] No tenant found for number:", ourNumber);
        return res.status(200).json({ success: true });
      }

      const tenantId = resolved.tenantId;

      const db = await getDb();

      const updated = await CallTrackingService.updateCallStatus(db, tenantId, callSid, {
        status,
        answeredAt: status === "in_progress" ? new Date() : undefined,
        endedAt: status === "completed" || status === "voicemail" ? new Date() : undefined,
        duration: payload.duration_secs ? Math.round(payload.duration_secs) : undefined,
      });

      if (!updated) {
        await CallTrackingService.logCall(db, {
          tenantId,
          direction: direction as "inbound" | "outbound",
          callerNumber: from,
          calledNumber: to,
          status,
          startedAt: new Date(),
          provider: "telnyx",
          providerCallSid: callSid,
        });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("[Voice/Telnyx] Webhook error:", error);
      res.status(200).json({ success: true });
    }
  });

  /**
   * Generic Voice Webhook
   * Accepts JSON from any VoIP provider. Requires X-API-Key header for auth.
   */
  app.post("/api/webhooks/voice/generic", async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers["x-api-key"] as string;
      const webhookSecret = process.env.VOICE_WEBHOOK_SECRET;

      if (!apiKey || !webhookSecret || apiKey !== webhookSecret) {
        return res.status(401).json({ error: "Invalid API key" });
      }

      const { tenantId, direction, callerNumber, calledNumber, status, duration, startedAt, externalId, recordingUrl, notes } = req.body;

      if (!tenantId || !direction || !callerNumber || !calledNumber) {
        return res.status(400).json({ error: "Missing required fields: tenantId, direction, callerNumber, calledNumber" });
      }

      const db = await getDb();

      // If externalId provided, try update first
      if (externalId) {
        const updated = await CallTrackingService.updateCallStatus(db, tenantId, externalId, {
          status: status ?? "completed",
          duration: duration ?? 0,
          endedAt: new Date(),
          recordingUrl,
        });

        if (updated) {
          return res.status(200).json({ success: true, action: "updated" });
        }
      }

      const callId = await CallTrackingService.logCall(db, {
        tenantId,
        direction,
        callerNumber,
        calledNumber,
        status: status ?? "completed",
        duration: duration ?? 0,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        endedAt: duration ? new Date(Date.now()) : undefined,
        provider: "webhook",
        providerCallSid: externalId,
        recordingUrl,
        notes,
      });

      res.status(201).json({ success: true, callId, action: "created" });
    } catch (error) {
      console.error("[Voice/Generic] Webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Twilio Outbound Connect Bridge
   * When an employee initiates a call via click-to-call, Twilio calls the employee first.
   * When employee answers, this TwiML connects them to the lead's phone.
   */
  app.post("/api/webhooks/voice/twilio/connect", async (req: Request, res: Response) => {
    try {
      const leadPhone = req.query.to as string;
      const tenantIdStr = req.query.tenantId as string;

      if (!leadPhone) {
        return res.status(400).type("text/xml").send("<Response><Say>Missing destination number</Say></Response>");
      }

      // Get tenant's tracking number for caller ID
      const tenantId = parseInt(tenantIdStr) || 0;
      let callerId = req.body?.To || ""; // The tracking number Twilio used to call the employee

      if (tenantId) {
        const db = await getDb();
        const [trackingNum] = await db
          .select({ number: phoneNumbers.number })
          .from(phoneNumbers)
          .where(and(eq(phoneNumbers.tenantId, tenantId), eq(phoneNumbers.type, "tracking"), eq(phoneNumbers.status, "active")))
          .limit(1);
        if (trackingNum) callerId = trackingNum.number;
      }

      // Bridge the employee to the lead
      res.status(200).type("text/xml").send(
        `<Response><Dial callerId="${callerId}" timeout="30" record="record-from-answer-dual">${leadPhone}</Dial></Response>`
      );
    } catch (error) {
      console.error("[Voice/Twilio/Connect] Error:", error);
      res.status(200).type("text/xml").send("<Response><Say>An error occurred</Say></Response>");
    }
  });

  console.log("[Voice] Call webhook endpoints registered: /api/webhooks/voice/{twilio,telnyx,generic,twilio/connect}");
}
