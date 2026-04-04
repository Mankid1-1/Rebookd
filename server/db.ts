import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";
import { logger } from "./_core/logger";

// Fallback to SQLite for development if MySQL is not available
// @ts-ignore - better-sqlite3 is an optional dev dependency
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
// @ts-ignore - better-sqlite3 is an optional dev dependency
import Database from "better-sqlite3";

let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function getDb() {
  if (_db) return _db;

  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.RAILWAY_URL;

  if (!dbUrl) {
    throw new Error("DATABASE_URL or RAILWAY_URL environment variable is required");
  }

  // Try MySQL first, fallback to SQLite for development
  if (dbUrl.startsWith('mysql')) {
    try {
      _pool = mysql.createPool({
        uri: dbUrl,
        waitForConnections: true,
        connectionLimit: parseInt(process.env.DB_POOL_SIZE || "10", 10),
        queueLimit: 50,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10_000,
        connectTimeout: 10_000,
        idleTimeout: 60_000,
        maxIdle: parseInt(process.env.DB_MAX_IDLE || "5", 10),
        // SSL for remote connections — verify certificates in production
        ...(dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? {} : {
          ssl: {
            rejectUnauthorized: process.env.NODE_ENV === "production",
            ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
          },
        }),
      });

      // Prevent unhandled 'error' events from crashing Node
      (_pool as any).on("error", (err: any) => {
        logger.error("MySQL pool error (non-fatal, pool will self-heal)", {
          error: err?.message ?? String(err),
          code: err?.code,
        });
      });

      _db = drizzle(_pool, { schema, mode: "default" }) as unknown as ReturnType<typeof drizzle<typeof schema>>;
      return _db;
    } catch (error) {
      console.warn('MySQL connection failed, falling back to SQLite:', error);
    }
  }

  // SQLite fallback for development only
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MySQL connection required in production. Check DATABASE_URL.');
  }
  console.log('Using SQLite for development');
  const sqlite = new Database('./rebooked-dev.db');
  _db = drizzleSqlite(sqlite, { schema }) as unknown as ReturnType<typeof drizzle<typeof schema>>;
  return _db;
}

/**
 * Run a callback inside a MySQL transaction.
 * Automatically commits on success, rolls back on error.
 */
export async function withTransaction<T>(
  fn: (db: ReturnType<typeof drizzle<typeof schema>>) => Promise<T>,
): Promise<T> {
  if (!_pool) await getDb();
  if (!_pool) throw new Error("Database pool not initialized");

  const conn = await _pool.getConnection();
  try {
    await conn.beginTransaction();
    const txDb = drizzle(conn, { schema, mode: "default" }) as unknown as ReturnType<typeof drizzle<typeof schema>>;
    const result = await fn(txDb);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/** Ping the DB — used by the health check endpoint. */
export async function pingDb(): Promise<boolean> {
  try {
    // Ensure DB is initialized before pinging
    if (!_pool) await getDb();
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
