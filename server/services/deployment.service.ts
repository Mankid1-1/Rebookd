import { desc, eq } from "drizzle-orm";
import { deployments } from "../../drizzle/schema";
import type { Db } from "../_core/context";
import type { InsertDeployment } from "../../drizzle/schema";

export async function recordDeployment(db: Db, data: Omit<InsertDeployment, "id">) {
  const [result] = await db.insert(deployments).values(data).$returningId();
  return result;
}

export async function updateDeploymentStatus(
  db: Db,
  id: number,
  status: "uploading" | "reloading" | "verified" | "failed" | "rolled_back",
  extra?: { durationMs?: number; completedAt?: Date },
) {
  await db.update(deployments).set({ status, ...extra }).where(eq(deployments.id, id));
}

export async function getDeployHistory(db: Db, limit = 20) {
  return db
    .select()
    .from(deployments)
    .orderBy(desc(deployments.createdAt))
    .limit(limit);
}

export async function getLatestDeployment(db: Db) {
  const [row] = await db
    .select()
    .from(deployments)
    .orderBy(desc(deployments.createdAt))
    .limit(1);
  return row ?? null;
}
