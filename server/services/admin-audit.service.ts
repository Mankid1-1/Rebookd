import { adminAuditLogs } from "../../drizzle/schema";
import type { Db } from "../_core/context";

export async function recordAdminAudit(
  db: Db,
  input: {
    adminUserId: number;
    adminEmail?: string | null;
    action: string;
    route?: string;
    targetTenantId?: number;
    targetUserId?: number;
    metadata?: Record<string, unknown>;
  },
) {
  await db.insert(adminAuditLogs).values({
    adminUserId: input.adminUserId,
    adminEmail: input.adminEmail ?? undefined,
    action: input.action,
    route: input.route,
    targetTenantId: input.targetTenantId,
    targetUserId: input.targetUserId,
    metadata: input.metadata,
  });
}
