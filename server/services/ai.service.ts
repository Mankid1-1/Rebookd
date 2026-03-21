import { eq, desc, and } from "drizzle-orm";
import { aiMessageLogs } from "../../drizzle/schema";

import type { Db } from "../_core/context";

export async function getAiLogs(db: Db, tenantId?: number, limit = 50, page = 1) {
  const offset = (page - 1) * limit;
  return db
    .select()
    .from(aiMessageLogs)
    .where(typeof tenantId === "number" ? and(eq(aiMessageLogs.tenantId, tenantId)) : undefined)
    .orderBy(desc(aiMessageLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function createAiLog(db: Db, data: {
  tenantId: number;
  leadId?: number;
  original: string;
  rewritten?: string;
  tone: string;
  success: boolean;
  error?: string;
}) {
  await db.insert(aiMessageLogs).values(data);
}
