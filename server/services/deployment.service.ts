import { desc, eq, gte, sql } from "drizzle-orm";
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

export async function getDeployStats(db: Db) {
  const allDeploys = await db
    .select()
    .from(deployments)
    .orderBy(desc(deployments.createdAt));

  const total = allDeploys.length;
  const verified = allDeploys.filter((d) => d.status === "verified").length;
  const failed = allDeploys.filter((d) => d.status === "failed").length;
  const rolledBack = allDeploys.filter((d) => d.status === "rolled_back").length;
  const successRate = total > 0 ? Math.round((verified / total) * 100) : 0;

  // Avg duration of verified deploys
  const durations = allDeploys
    .filter((d) => d.status === "verified" && d.durationMs)
    .map((d) => d.durationMs!);
  const avgDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

  // Deploys in last 24h
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last24h = allDeploys.filter(
    (d) => d.createdAt && new Date(d.createdAt) > dayAgo,
  ).length;

  // Deploys in last 7d
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last7d = allDeploys.filter(
    (d) => d.createdAt && new Date(d.createdAt) > weekAgo,
  ).length;

  // Current success streak (consecutive verified from most recent)
  let streak = 0;
  for (const d of allDeploys) {
    if (d.status === "verified") streak++;
    else break;
  }

  // Last failure
  const lastFailure = allDeploys.find(
    (d) => d.status === "failed" || d.status === "rolled_back",
  );

  // Fastest & slowest verified deploy
  const fastestMs = durations.length > 0 ? Math.min(...durations) : null;
  const slowestMs = durations.length > 0 ? Math.max(...durations) : null;

  return {
    total,
    verified,
    failed,
    rolledBack,
    successRate,
    avgDurationMs,
    fastestMs,
    slowestMs,
    last24h,
    last7d,
    streak,
    lastFailureAt: lastFailure?.createdAt?.toISOString() ?? null,
  };
}
