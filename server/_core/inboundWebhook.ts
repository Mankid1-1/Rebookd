import type { Express, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { leads, messages, phoneNumbers } from "../../drizzle/schema";
import { emitEvent } from "../services/event-bus.service";
import * as SystemService from "../services/system.service";
import { logger } from "./logger";
import { captureException } from "./sentry";
import { encrypt } from "./crypto";
import { hashPhoneNumber, normalizePhoneNumber } from "./phone";
import { sendSMS } from "./sms";
import { getCorrelationId } from "./requestContext";

const STOP_KEYWORDS = new Set(["stop", "unsubscribe", "quit", "cancel", "end", "stopall"]);
const START_KEYWORDS = new Set(["start", "yes", "unstop"]);

interface InboundMessage {
  from: string;
  to: string;
  body: string;
}

function isStrictWebhookMode(): boolean {
  return process.env.NODE_ENV !== "development";
}

function getRawBody(req: Request): string {
  return String((req as any).rawBody || "");
}

function verifyTelnyxSignature(req: Request): boolean {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  if (!publicKey) return !isStrictWebhookMode();

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

function verifyTwilioSignature(req: Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return !isStrictWebhookMode();

  const twilioSignature = req.headers["x-twilio-signature"] as string;
  if (!twilioSignature) return false;

  const params = Object.fromEntries(new URLSearchParams(getRawBody(req) || ""));
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

function parseTelnyx(body: any): InboundMessage | null {
  const payload = body?.data?.payload;
  if (!payload) return null;
  return {
    from: payload.from?.phone_number ?? "",
    to: payload.to?.[0]?.phone_number ?? "",
    body: payload.text ?? "",
  };
}

function parseTwilio(body: any): InboundMessage | null {
  if (!body?.From || !body?.Body) return null;
  return { from: body.From, to: body.To ?? "", body: body.Body };
}

async function logRejectedWebhook(route: string, provider: "twilio" | "telnyx", reason: string, req: Request) {
  const db = await getDb();
  if (!db) return;
  await SystemService.createSystemError(db as any, {
    type: "webhook",
    message: `${provider} webhook rejected`,
    detail: JSON.stringify({
      route,
      reason,
      correlationId: (req as any).correlationId,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    }),
  }).catch(() => undefined);
}

async function handleInbound(msg: InboundMessage) {
  const body = msg.body.trim();
  if (!msg.from || !body) return;

  const from = normalizePhoneNumber(msg.from);
  const to = msg.to ? normalizePhoneNumber(msg.to) : "";
  const db = await getDb();
  if (!db) return;

  const bodyNorm = body.toLowerCase().replace(/[^a-z]/g, "");
  const autoCreateLeads = process.env.INBOUND_AUTO_CREATE_LEADS !== "false";
  const minBodyForNewLead = parseInt(process.env.MIN_INBOUND_LEAD_BODY_LEN || "1", 10);
  let tenantId: number | undefined;

  if (to) {
    const [numRow] = await db
      .select({ tenantId: phoneNumbers.tenantId })
      .from(phoneNumbers)
      .where(and(eq(phoneNumbers.number, to), isNull(phoneNumbers.deletedAt)))
      .limit(1);
    tenantId = numRow?.tenantId;
  }

  if (!tenantId) {
    logger.warn("Inbound SMS for unknown number", { to });
    return;
  }

  const encryptedFrom = encrypt(from);
  const phoneHash = hashPhoneNumber(from);
  const [existingLead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.tenantId, tenantId), eq(leads.phoneHash, phoneHash)))
    .limit(1);

  let lead = existingLead;
  if (!lead) {
    if (STOP_KEYWORDS.has(bodyNorm)) {
      logger.info("STOP from unknown sender — no lead row", { tenantId, correlationId: getCorrelationId() });
      return;
    }
    if (!autoCreateLeads) {
      logger.info("Inbound SMS ignored (no existing lead, INBOUND_AUTO_CREATE_LEADS=false)", { tenantId });
      return;
    }
    if (body.length < minBodyForNewLead) {
      logger.info("Inbound SMS ignored (short message, no existing lead)", { tenantId, len: body.length });
      return;
    }
    await db.insert(leads).values({
      tenantId,
      phone: encryptedFrom,
      phoneHash,
      status: "new",
      lastInboundAt: new Date(),
      lastMessageAt: new Date(),
    });
    const [createdLead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), eq(leads.phoneHash, phoneHash)))
      .limit(1);
    lead = createdLead;
    if (!lead) return;
  }

  if (STOP_KEYWORDS.has(bodyNorm)) {
    await db
      .update(leads)
      .set({ status: "unsubscribed", updatedAt: new Date(), lastInboundAt: new Date() })
      .where(eq(leads.id, lead.id));
  } else if (START_KEYWORDS.has(bodyNorm) && lead.status === "unsubscribed") {
    await db
      .update(leads)
      .set({ status: "new", updatedAt: new Date(), lastInboundAt: new Date() })
      .where(eq(leads.id, lead.id));
  }

  await db.insert(messages).values({
    tenantId,
    leadId: lead.id,
    direction: "inbound",
    body,
    fromNumber: encryptedFrom,
    toNumber: to,
    status: "received",
  });

  await db
    .update(leads)
    .set({ lastInboundAt: new Date(), lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, lead.id));

  if (STOP_KEYWORDS.has(bodyNorm)) {
    const stopText =
      process.env.TCPA_STOP_REPLY_TEXT ||
      "You have been unsubscribed from SMS from this business. Reply START to receive messages again.";
    await sendSMS(from, stopText, undefined, tenantId).catch((err) =>
      logger.warn("TCPA STOP confirmation SMS failed", { error: String(err) }),
    );
    await SystemService.createSystemError(db as any, {
      type: "webhook",
      message: "TCPA STOP — lead unsubscribed",
      detail: JSON.stringify({
        tenantId,
        leadId: lead.id,
        from,
        correlationId: getCorrelationId(),
      }),
      tenantId,
    }).catch(() => undefined);
  } else {
    await emitEvent({
      type: "message.received",
      data: { leadId: lead.id, body, from, to },
      tenantId,
      userId: undefined,
      timestamp: new Date(),
    });
  }

  logger.info("Inbound SMS processed", { tenantId, leadId: lead.id, preview: body.slice(0, 40), correlationId: getCorrelationId() });
}

export function registerInboundWebhooks(app: Express) {
  app.post("/api/sms/inbound", async (req: Request, res: Response) => {
    if (!verifyTelnyxSignature(req)) {
      logger.warn("Telnyx signature verification failed");
      await logRejectedWebhook("/api/sms/inbound", "telnyx", "invalid_signature", req);
      res.status(403).json({ error: "Invalid signature" });
      return;
    }

    res.status(200).json({ received: true });
    try {
      const msg = parseTelnyx(req.body);
      if (msg) await handleInbound(msg);
    } catch (error) {
      logger.error("Telnyx inbound handler error", { error: String(error) });
      captureException(error, { route: "/api/sms/inbound" });
    }
  });

  app.post("/api/twilio/inbound", async (req: Request, res: Response) => {
    if (!verifyTwilioSignature(req)) {
      logger.warn("Twilio signature verification failed");
      await logRejectedWebhook("/api/twilio/inbound", "twilio", "invalid_signature", req);
      res.status(403).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      return;
    }

    res.set("Content-Type", "text/xml");
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    try {
      const msg = parseTwilio(req.body);
      if (msg) await handleInbound(msg);
    } catch (error) {
      logger.error("Twilio inbound handler error", { error: String(error) });
      captureException(error, { route: "/api/twilio/inbound" });
    }
  });
}
