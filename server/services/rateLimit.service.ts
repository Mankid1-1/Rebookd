import { and, eq, gte, ne, sql } from "drizzle-orm";
import { messages, smsRateLimits } from "../../drizzle/schema";
import { AppError } from "../_core/appErrors";
import type { Db } from "../_core/context";

/** Optional hourly / daily caps on outbound SMS (counts successful rows in `messages`). */
export async function assertSmsHourlyDailyLimits(db: Db, tenantId: number) {
  const hourlyCap = parseInt(process.env.SMS_HOURLY_CAP || "0", 10);
  const dailyCap = parseInt(process.env.SMS_DAILY_CAP_PER_TENANT || "0", 10);
  if (hourlyCap <= 0 && dailyCap <= 0) return;

  const sinceHour = new Date(Date.now() - 60 * 60 * 1000);
  const sinceDay = new Date();
  sinceDay.setHours(0, 0, 0, 0);

  if (hourlyCap > 0) {
    const [{ c }] = await db
      .select({ c: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          eq(messages.direction, "outbound"),
          ne(messages.status, "failed"),
          gte(messages.createdAt, sinceHour),
        ),
      );
    if (Number(c) >= hourlyCap) {
      throw new AppError("RATE_LIMITED", `Hourly SMS limit exceeded (${hourlyCap}/hour)`, 429);
    }
  }

  if (dailyCap > 0) {
    const [{ c }] = await db
      .select({ c: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          eq(messages.direction, "outbound"),
          ne(messages.status, "failed"),
          gte(messages.createdAt, sinceDay),
        ),
      );
    if (Number(c) >= dailyCap) {
      throw new AppError("RATE_LIMITED", `Daily SMS limit exceeded (${dailyCap}/day)`, 429);
    }
  }
}

export async function assertSmsRateLimitAvailable(db: Db, tenantId: number) {
  const windowStart = new Date();
  windowStart.setSeconds(0, 0);
  const bucket = windowStart;
  const maxPerMinute = parseInt(process.env.SMS_RATE_LIMIT || "60", 10);

  const [row] = await db
    .select()
    .from(smsRateLimits)
    .where(and(eq(smsRateLimits.tenantId, tenantId), eq(smsRateLimits.windowStart, bucket)))
    .limit(1);

  if (row && row.count >= maxPerMinute) {
    throw new AppError("RATE_LIMITED", `Rate limit exceeded (${maxPerMinute} SMS/min)`, 429);
  }

  if (row) {
    await db
      .update(smsRateLimits)
      .set({ count: row.count + 1, updatedAt: new Date() })
      .where(eq(smsRateLimits.id, row.id));
  } else {
    await db.insert(smsRateLimits).values({
      tenantId,
      windowStart: bucket,
      count: 1,
      updatedAt: new Date(),
    });
  }
}
