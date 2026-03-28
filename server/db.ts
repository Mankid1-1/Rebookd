import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";

// Fallback to SQLite for development if MySQL is not available
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
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
        // Only use SSL for remote connections
        ...(dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? {} : { ssl: { rejectUnauthorized: false } }),
      });

      // The cast is needed because getDb() returns the Db alias (MySql2Database<schema>)
      // but drizzle() infers a slightly different generic signature.
      _db = drizzle(_pool, { schema, mode: "default" }) as ReturnType<typeof drizzle<typeof schema>>;
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
  // SQLite fallback for dev - cast to MySQL Db type since all callers expect it
  _db = drizzleSqlite(sqlite, { schema }) as unknown as ReturnType<typeof drizzle<typeof schema>>;
  return _db;
}

/** Ping the DB — used by the health check endpoint. */
export async function pingDb(): Promise<boolean> {
  try {
    // Ensure DB is initialized before pinging
    if (!_pool) await getDb();
    const pool = _pool;
    if (!pool) return false;
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch {
    return false;
  }
}
