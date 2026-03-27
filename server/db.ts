import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";

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
    ...(process.env.DB_SSL !== "false" && !dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  });

  _db = drizzle(_pool, { schema, mode: "default" }) as any;
  return _db;
}

/** Ping the DB — used by the health check endpoint. */
export async function pingDb(): Promise<boolean> {
  try {
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
