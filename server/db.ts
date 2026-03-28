import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";
import { logger } from "./_core/logger";

let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function getDb() {
  if (_db) return _db;

  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.RAILWAY_URL ||
    "mysql://root:example@db:3306/rebooked";

  _pool = mysql.createPool({
    uri: dbUrl,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_SIZE || "10", 10),
    queueLimit: 50,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    connectTimeout: 10_000,
    // Query timeouts for production safety
    timeout: parseInt(process.env.DB_QUERY_TIMEOUT || "30000", 10), // 30 seconds default
    acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || "60000", 10), // 60 seconds
    ssl: { rejectUnauthorized: false },
  });

  // Prevent unhandled 'error' events from crashing Node
  _pool.on("error", (err) => {
    logger.error("MySQL pool error (non-fatal, pool will self-heal)", {
      error: err.message,
      code: (err as any).code,
    });
  });

  _db = drizzle(_pool, { schema, mode: "default" }) as any;
  return _db;
}

/** Ping the DB — used by the health check endpoint. */
export async function pingDb(): Promise<boolean> {
  try {
    const pool = _pool;
    if (!pool) return false;
    const conn = await pool.getConnection();
    try {
      await conn.ping();
      return true;
    } finally {
      conn.release();
    }
  } catch {
    return false;
  }
}
