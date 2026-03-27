import { eq, and } from "drizzle-orm";
import { featureConfigs } from "../../drizzle/schema";
import type { Db } from "../_core/context";

/**
 * Retrieve the stored config for a given tenant + feature key.
 * Returns the config object, or null if none has been saved yet.
 */
export async function getConfig(
  db: Db,
  tenantId: number,
  feature: string,
): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select({ config: featureConfigs.config })
    .from(featureConfigs)
    .where(
      and(
        eq(featureConfigs.tenantId, tenantId),
        eq(featureConfigs.feature, feature),
      ),
    )
    .limit(1);

  return (row?.config as Record<string, unknown>) ?? null;
}

/**
 * Upsert the config for a given tenant + feature key.
 * Uses MySQL ON DUPLICATE KEY UPDATE via the unique (tenantId, feature) index.
 */
export async function saveConfig(
  db: Db,
  tenantId: number,
  feature: string,
  config: Record<string, unknown>,
): Promise<void> {
  await db
    .insert(featureConfigs)
    .values({ tenantId, feature, config })
    .onDuplicateKeyUpdate({
      set: { config, updatedAt: new Date() },
    });
}
