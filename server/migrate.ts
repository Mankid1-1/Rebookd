/**
 * Database migration runner — runs as a one-shot init job before the app starts.
 * In Docker Compose this is the `migrate` service (target: migrate in Dockerfile).
 * Exits 0 on success, 1 on failure so the orchestrator can gate app startup.
 */
import { migrate } from "drizzle-orm/mysql2/migrator";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.RAILWAY_URL ||
  "mysql://root:example@db:3306/rebooked";

// Columns added after initial schema — safe to re-run (ALTER TABLE IF NOT EXISTS not supported
// in MySQL 5.x, so we catch duplicate column errors).
const ENSURE_COLUMNS = [
  "ALTER TABLE `users` ADD COLUMN `passwordHash` varchar(255)",
  "ALTER TABLE `subscriptions` ADD COLUMN `trialReminderSent` boolean DEFAULT false NOT NULL",
  "ALTER TABLE `automations` ADD COLUMN `errorCount` int DEFAULT 0 NOT NULL",
  "ALTER TABLE `usage` ADD COLUMN `hasUsageAlerted` boolean DEFAULT false NOT NULL",
  "ALTER TABLE `plans` ADD COLUMN `stripePriceId` varchar(255)",
];

async function ensureColumns(conn: mysql.Connection) {
  for (const query of ENSURE_COLUMNS) {
    try {
      await conn.execute(query);
    } catch (err: any) {
      if (!err?.message?.includes("Duplicate column")) {
        console.warn(`[migrate] Column ensure notice: ${err?.message}`);
      }
    }
  }
}

async function run() {
  console.log("[migrate] Starting…");
  let conn: mysql.Connection | undefined;

  try {
    conn = await mysql.createConnection(dbUrl);
    await ensureColumns(conn);

    const db = drizzle(conn);
    await migrate(db, { migrationsFolder: "./drizzle" });

    console.log("[migrate] Done.");
    await conn.end();
    process.exit(0);
  } catch (err: any) {
    const msg = err?.message ?? "";
    if (msg.includes("Duplicate") || msg.includes("already exists")) {
      console.log("[migrate] Schema already up to date.");
      await conn?.end().catch(() => {});
      process.exit(0);
    }
    console.error("[migrate] Fatal:", err);
    await conn?.end().catch(() => {});
    process.exit(1);
  }
}

run();
