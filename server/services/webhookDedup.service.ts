import { webhookReceiveDedupes } from "../../drizzle/schema";
import type { Db } from "../_core/context";

/** Returns true if this is a new key; false if duplicate (retry). */
export async function tryClaimInboundWebhookDedup(db: Db, tenantId: number, dedupeKey: string): Promise<boolean> {
  try {
    await db.insert(webhookReceiveDedupes).values({ tenantId, dedupeKey });
    return true;
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    const msg = String((e as Error)?.message ?? e);
    if (code === "ER_DUP_ENTRY" || msg.includes("Duplicate")) return false;
    throw e;
  }
}
