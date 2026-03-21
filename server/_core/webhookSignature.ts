import { createHmac, timingSafeEqual } from "crypto";

/** Stable payload for HMAC — must match client integrations. */
export function buildInboundWebhookPayload(event: string, data: unknown, tenantId: number): string {
  return JSON.stringify({ event, data, tenantId });
}

export function signInboundWebhookPayload(secret: string, event: string, data: unknown, tenantId: number): string {
  const payload = buildInboundWebhookPayload(event, data, tenantId);
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyInboundWebhookSignature(
  secret: string,
  event: string,
  data: unknown,
  tenantId: number,
  signatureHex: string,
): boolean {
  const expected = signInboundWebhookPayload(secret, event, data, tenantId);
  try {
    const a = Buffer.from(String(signatureHex).trim(), "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
