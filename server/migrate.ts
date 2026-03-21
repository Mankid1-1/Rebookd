import { migrate } from "drizzle-orm/mysql2/migrator";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL || process.env.RAILWAY_URL || "mysql://root:example@db:3306/rebookd";

async function ensureColumnsExist(connection: any) {
  try {
    console.log("[Migrations] Ensuring required columns exist...");
    const queries = [
      "ALTER TABLE `users` ADD COLUMN `passwordHash` varchar(255)",
      "ALTER TABLE `subscriptions` ADD COLUMN `trialReminderSent` boolean DEFAULT false NOT NULL",
      "ALTER TABLE `automations` ADD COLUMN `errorCount` int DEFAULT 0 NOT NULL",
      "ALTER TABLE `usage` ADD COLUMN `hasUsageAlerted` boolean DEFAULT false NOT NULL",
      "ALTER TABLE `plans` ADD COLUMN `stripePriceId` varchar(255)",
    ];
    
    for (const query of queries) {
      try {
        await connection.execute(query);
      } catch (err: any) {
        // Ignore duplicate column errors - it means the column already exists
        const msg = err?.message || "";
        if (!msg.includes("Duplicate column")) {
          console.warn(`[Migrations] Column ensure notice for query "${query}":`, err);
        }
      }
    }
    console.log("[Migrations] Column check completed");
  } catch (err) {
    console.warn("[Migrations] Column ensure error (non-fatal):", err);
  }
}

async function runMigrations() {
  console.log("[Migrations] Starting database migrations...");
  
  let connection: any;
  try {
    connection = await mysql.createConnection(dbUrl);
    
    // First ensure columns exist (fixes partial migrations)
    await ensureColumnsExist(connection);
    
    // Then run drizzle migrations
    const db = drizzle(connection);
    try {
      await migrate(db, { migrationsFolder: "./drizzle" });
      console.log("[Migrations] Database migrations completed successfully");
    } catch (migrationError: any) {
      const msg = migrationError?.message || "";
      // Ignore known errors - they usually mean schema is already applied
      if (msg.includes("Duplicate") || msg.includes("already exists")) {
        console.log("[Migrations] Schema already up to date");
      } else {
        console.error("[Migrations] Migration failed:", migrationError);
      }
    }
    
    await connection.end();
  } catch (error) {
    console.error("[Migrations] Fatal error:", error);
    if (connection) await connection.end().catch(() => {});
    process.exit(1);
  }
}

runMigrations();
