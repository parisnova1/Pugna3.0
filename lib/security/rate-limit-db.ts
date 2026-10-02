import { prisma } from "@/lib/prisma";
import { consume, isLimited, resetCheck, type Check, type Counter, type RateLimitResult, type RateLimitStore } from "@/lib/security/rate-limit";

const UTC_NOW = "(now() AT TIME ZONE 'UTC')";

/**
 * Single-statement upsert: the increment and the window rollover happen
 * atomically inside Postgres, so concurrent requests can never both read the
 * same count and slip past the limit. Compared against UTC because the column
 * is a timezone-less timestamp.
 */
export const dbRateLimitStore: RateLimitStore = {
  async hit(key, windowSec) {
    const rows = await prisma.$queryRawUnsafe<{ count: number; resetAt: Date }[]>(
      `INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
       VALUES ($1, 1, ${UTC_NOW} + make_interval(secs => $2::double precision))
       ON CONFLICT ("key") DO UPDATE SET
         "count" = CASE WHEN "RateLimitBucket"."resetAt" <= ${UTC_NOW} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
         "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= ${UTC_NOW}
                          THEN ${UTC_NOW} + make_interval(secs => $2::double precision)
                          ELSE "RateLimitBucket"."resetAt" END
       RETURNING "count", "resetAt"`,
      key,
      windowSec,
    );
    // Opportunistic cleanup so the table doesn't grow without bound.
    if (Math.random() < 0.02) {
      await prisma.rateLimitBucket
        .deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
        .catch(() => undefined);
    }
    const row = rows[0]!;
    return { count: Number(row.count), resetAt: new Date(row.resetAt) } satisfies Counter;
  },

  async peek(key) {
    const row = await prisma.rateLimitBucket.findUnique({ where: { key } });
    return row && row.resetAt.getTime() > Date.now() ? { count: row.count, resetAt: row.resetAt } : null;
  },

  async reset(key) {
    await prisma.rateLimitBucket.deleteMany({ where: { key } });
  },
};

export const rateLimit = (checks: Check[]): Promise<RateLimitResult> => consume(dbRateLimitStore, checks);
export const rateLimited = (checks: Check[]): Promise<boolean> => isLimited(dbRateLimitStore, checks);
export const clearRateLimit = (check: Check): Promise<void> => resetCheck(dbRateLimitStore, check);
