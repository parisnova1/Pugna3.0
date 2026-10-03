import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertNotProduction } from "./helpers/db-guard";

/**
 * Integration tests against a REAL Postgres. They only run when
 * TEST_DATABASE_URL is set (point it at a disposable Neon branch -- never at
 * the production database), so a normal `npm test` skips them.
 */
const url = process.env.TEST_DATABASE_URL;
const runId = Math.random().toString(36).slice(2, 10);

describe.skipIf(!url)("security primitives against real Postgres", () => {
  let db: typeof import("@/lib/prisma").prisma;
  let store: typeof import("@/lib/security/rate-limit-db").dbRateLimitStore;
  let tokens: typeof import("@/lib/security/auth-tokens");
  const userIds: string[] = [];

  beforeAll(async () => {
    assertNotProduction(url!);
    process.env.DATABASE_URL = url;
    db = (await import("@/lib/prisma")).prisma;
    store = (await import("@/lib/security/rate-limit-db")).dbRateLimitStore;
    tokens = await import("@/lib/security/auth-tokens");
  });

  afterAll(async () => {
    if (!db) return;
    await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: `test:${runId}` } } });
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } }); // cascades to AuthToken
    await db.$disconnect();
  });

  async function throwawayUser() {
    const user = await db.user.create({
      data: { email: `sec-${runId}-${userIds.length}@pugna.invalid`, passwordHash: "x", name: "security test" },
    });
    userIds.push(user.id);
    return user;
  }

  it("counts concurrent attempts exactly once each (no lost updates)", async () => {
    const key = `test:${runId}:atomic`;
    const results = await Promise.all(Array.from({ length: 25 }, () => store.hit(key, 60)));
    const counts = results.map((r) => r.count).sort((a, b) => a - b);
    expect(counts).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it("opens a fresh window after expiry", async () => {
    const key = `test:${runId}:window`;
    await store.hit(key, 1);
    expect((await store.hit(key, 1)).count).toBe(2);
    await new Promise((r) => setTimeout(r, 1300));
    expect((await store.hit(key, 1)).count).toBe(1);
  });

  it("returns a reset time in the future and supports peek/reset", async () => {
    const key = `test:${runId}:peek`;
    expect(await store.peek(key)).toBeNull();
    const { resetAt } = await store.hit(key, 60);
    expect(resetAt.getTime()).toBeGreaterThan(Date.now() + 50_000);
    expect((await store.peek(key))?.count).toBe(1);
    await store.reset(key);
    expect(await store.peek(key)).toBeNull();
  });

  it("lets exactly one of several simultaneous requests spend a token", async () => {
    const user = await throwawayUser();
    const raw = await tokens.issueToken(db, user.id, "PASSWORD_RESET");
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => tokens.consumeToken(db, raw, "PASSWORD_RESET")));
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(await tokens.consumeToken(db, raw, "PASSWORD_RESET")).toEqual({ ok: false });
  });

  it("refuses an expired token and a token of the wrong type", async () => {
    const user = await throwawayUser();
    const long = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const expired = await tokens.issueToken(db, user.id, "PASSWORD_RESET", long);
    expect(await tokens.consumeToken(db, expired, "PASSWORD_RESET")).toEqual({ ok: false });
    const verify = await tokens.issueToken(db, user.id, "EMAIL_VERIFY");
    expect(await tokens.consumeToken(db, verify, "PASSWORD_RESET")).toEqual({ ok: false });
  });

  it("never stores the raw token", async () => {
    const user = await throwawayUser();
    const raw = await tokens.issueToken(db, user.id, "EMAIL_VERIFY");
    const rows = await db.authToken.findMany({ where: { userId: user.id } });
    expect(JSON.stringify(rows)).not.toContain(raw);
  });
});
