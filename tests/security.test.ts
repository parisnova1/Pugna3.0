import { describe, expect, it, vi, afterEach } from "vitest";
import {
  consume,
  createMemoryStore,
  isLimited,
  limiterKey,
  resetCheck,
  retryMessage,
  type Policy,
  type RateLimitStore,
} from "@/lib/security/rate-limit";
import { POLICIES } from "@/lib/security/policies";
import { clientIp } from "@/lib/security/client-ip";
import { generateToken, hashToken, looksLikeToken, TOKEN_TTL_MS } from "@/lib/security/tokens";
import { consumeToken, issueToken } from "@/lib/security/auth-tokens";
import {
  BCRYPT_COST,
  DUMMY_HASH,
  hashPassword,
  isPlausibleEmail,
  needsRehash,
  normalizeEmail,
  validateNewPassword,
  verifyPassword,
} from "@/lib/security/password";
import { appUrl, isEmailConfigured, passwordResetEmail, sendEmail, verificationEmail } from "@/lib/security/email";
import bcrypt from "bcryptjs";

const POLICY: Policy = { name: "t", limit: 3, windowSec: 60 };

describe("rate limiting", () => {
  it("allows up to the limit then blocks, with a retry hint", async () => {
    const t = 1_000_000;
    const store = createMemoryStore(() => t);
    const check = [{ policy: POLICY, subject: "a@x.com" }];
    for (let i = 0; i < 3; i++) expect((await consume(store, check, () => t)).ok).toBe(true);
    const blocked = await consume(store, check, () => t);
    expect(blocked).toMatchObject({ ok: false });
    expect(blocked.ok === false && blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.ok === false && blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("opens a fresh window once the old one expires", async () => {
    let t = 0;
    const store = createMemoryStore(() => t);
    const check = [{ policy: POLICY, subject: "a" }];
    for (let i = 0; i < 4; i++) await consume(store, check, () => t);
    expect((await consume(store, check, () => t)).ok).toBe(false);
    t += 61_000;
    expect((await consume(store, check, () => t)).ok).toBe(true);
  });

  it("keeps different subjects independent", async () => {
    const store = createMemoryStore();
    for (let i = 0; i < 5; i++) await consume(store, [{ policy: POLICY, subject: "attacker" }]);
    expect((await consume(store, [{ policy: POLICY, subject: "victim" }])).ok).toBe(true);
  });

  it("blocks when ANY of several checks is exhausted", async () => {
    const store = createMemoryStore();
    const tight: Policy = { name: "tight", limit: 1, windowSec: 60 };
    const loose: Policy = { name: "loose", limit: 100, windowSec: 60 };
    const checks = [
      { policy: loose, subject: "ip" },
      { policy: tight, subject: "email" },
    ];
    expect((await consume(store, checks)).ok).toBe(true);
    expect((await consume(store, checks)).ok).toBe(false);
  });

  it("fails closed when the store is unavailable", async () => {
    const broken: RateLimitStore = {
      hit: async () => {
        throw new Error("db down");
      },
      peek: async () => {
        throw new Error("db down");
      },
      reset: async () => undefined,
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await consume(broken, [{ policy: POLICY, subject: "x" }]);
    expect(result).toMatchObject({ ok: false, unavailable: true });
    expect(await isLimited(broken, [{ policy: POLICY, subject: "x" }])).toBe(true);
    spy.mockRestore();
  });

  it("never puts the raw email or IP in a stored key", () => {
    const key = limiterKey(POLICY, "victim@example.com");
    expect(key).not.toContain("victim");
    expect(key).not.toContain("example.com");
    expect(limiterKey(POLICY, "1.2.3.4")).not.toContain("1.2.3.4");
  });

  it("peek reports a limited subject without counting, and reset clears it", async () => {
    const store = createMemoryStore();
    const check = { policy: POLICY, subject: "a" };
    for (let i = 0; i < 3; i++) await consume(store, [check]);
    expect(await isLimited(store, [check])).toBe(true);
    await resetCheck(store, check);
    expect(await isLimited(store, [check])).toBe(false);
  });

  it("login is limited per identity, per email and per IP", async () => {
    const store = createMemoryStore();
    const attempt = (ip: string, email: string) =>
      consume(store, [
        { policy: POLICIES.loginIp, subject: ip },
        { policy: POLICIES.loginIdentity, subject: `${email}|${ip}` },
        { policy: POLICIES.loginEmail, subject: email },
      ]);
    // Brute-forcing one account from one address is cut off after 5 tries.
    for (let i = 0; i < 5; i++) expect((await attempt("9.9.9.9", "v@x.com")).ok).toBe(true);
    expect((await attempt("9.9.9.9", "v@x.com")).ok).toBe(false);
    // ...but the real owner on another IP is not locked out by that attacker.
    expect((await attempt("5.5.5.5", "v@x.com")).ok).toBe(true);
    // Password-spraying many accounts from one IP hits the per-IP cap.
    let sprayed = 0;
    for (let i = 0; i < 40; i++) if ((await attempt("7.7.7.7", `user${i}@x.com`)).ok) sprayed++;
    expect(sprayed).toBe(POLICIES.loginIp.limit);
  });

  it("formats a human retry message", () => {
    expect(retryMessage(30)).toMatch(/a minute/);
    expect(retryMessage(600)).toMatch(/10 minutes/);
  });
});

describe("client ip", () => {
  const h = (map: Record<string, string>) => ({ get: (n: string) => map[n] ?? null });
  it("prefers x-real-ip, then the first forwarded address, else 'unknown'", () => {
    expect(clientIp(h({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(h({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientIp(h({}))).toBe("unknown");
  });
});

describe("tokens", () => {
  it("are unique, long and only ever stored hashed", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.raw).toHaveLength(43);
    expect(a.hash).toBe(hashToken(a.raw));
    expect(a.hash).not.toContain(a.raw);
    expect(looksLikeToken(a.raw)).toBe(true);
  });

  it("rejects malformed input before touching the database", () => {
    for (const bad of ["", "short", "x".repeat(44), "../../etc/passwd" + "a".repeat(30), undefined, 42, null]) {
      expect(looksLikeToken(bad)).toBe(false);
    }
  });

  it("reset links are short-lived and verification links last a day", () => {
    expect(TOKEN_TTL_MS.PASSWORD_RESET).toBe(30 * 60 * 1000);
    expect(TOKEN_TTL_MS.EMAIL_VERIFY).toBe(24 * 60 * 60 * 1000);
  });
});

// A minimal in-memory stand-in for prisma.authToken that implements the exact
// conditional semantics consumeToken relies on.
function fakeTokenDb() {
  type Row = { id: string; userId: string; type: string; tokenHash: string; expiresAt: Date; usedAt: Date | null };
  const rows: Row[] = [];
  let seq = 0;
  const db = {
    authToken: {
      create: async ({ data }: { data: Omit<Row, "id" | "usedAt"> }) => {
        const row = { id: String(++seq), usedAt: null, ...data };
        rows.push(row);
        return row;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: { usedAt: Date } }) => {
        const matches = rows.filter(
          (r) =>
            (where.userId === undefined || r.userId === where.userId) &&
            (where.type === undefined || r.type === where.type) &&
            (where.tokenHash === undefined || r.tokenHash === where.tokenHash) &&
            (where.usedAt !== null || r.usedAt === null) &&
            (where.expiresAt === undefined || r.expiresAt > (where.expiresAt as { gt: Date }).gt),
        );
        matches.forEach((r) => (r.usedAt = data.usedAt));
        return { count: matches.length };
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) => rows.find((r) => r.tokenHash === where.tokenHash) ?? null,
    },
  };
  return { db: db as unknown as Parameters<typeof issueToken>[0], rows };
}

describe("one-time email tokens (abuse cases)", () => {
  it("stores only the hash, never the emailed secret", async () => {
    const { db, rows } = fakeTokenDb();
    const raw = await issueToken(db, "u1", "PASSWORD_RESET");
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(raw);
    expect(rows[0]!.tokenHash).toBe(hashToken(raw));
  });

  it("works exactly once (replay is refused)", async () => {
    const { db } = fakeTokenDb();
    const raw = await issueToken(db, "u1", "PASSWORD_RESET");
    expect(await consumeToken(db, raw, "PASSWORD_RESET")).toEqual({ ok: true, userId: "u1" });
    expect(await consumeToken(db, raw, "PASSWORD_RESET")).toEqual({ ok: false });
  });

  it("expires", async () => {
    const { db } = fakeTokenDb();
    const issuedAt = new Date("2026-01-01T00:00:00Z");
    const raw = await issueToken(db, "u1", "PASSWORD_RESET", issuedAt);
    const late = new Date(issuedAt.getTime() + TOKEN_TTL_MS.PASSWORD_RESET + 1000);
    expect(await consumeToken(db, raw, "PASSWORD_RESET", late)).toEqual({ ok: false });
    expect(await consumeToken(db, raw, "PASSWORD_RESET", new Date(issuedAt.getTime() + 60_000))).toEqual({ ok: true, userId: "u1" });
  });

  it("can't be used for a different purpose than it was issued for", async () => {
    const { db } = fakeTokenDb();
    const verify = await issueToken(db, "u1", "EMAIL_VERIFY");
    expect(await consumeToken(db, verify, "PASSWORD_RESET")).toEqual({ ok: false });
  });

  it("requesting a new link retires the previous one", async () => {
    const { db } = fakeTokenDb();
    const first = await issueToken(db, "u1", "PASSWORD_RESET");
    const second = await issueToken(db, "u1", "PASSWORD_RESET");
    expect(await consumeToken(db, first, "PASSWORD_RESET")).toEqual({ ok: false });
    expect(await consumeToken(db, second, "PASSWORD_RESET")).toEqual({ ok: true, userId: "u1" });
  });

  it("one user's new link doesn't invalidate another user's", async () => {
    const { db } = fakeTokenDb();
    const a = await issueToken(db, "alice", "PASSWORD_RESET");
    await issueToken(db, "bob", "PASSWORD_RESET");
    expect(await consumeToken(db, a, "PASSWORD_RESET")).toEqual({ ok: true, userId: "alice" });
  });

  it("refuses forged, guessed and malformed tokens", async () => {
    const { db } = fakeTokenDb();
    await issueToken(db, "u1", "PASSWORD_RESET");
    expect(await consumeToken(db, generateToken().raw, "PASSWORD_RESET")).toEqual({ ok: false });
    expect(await consumeToken(db, "nope", "PASSWORD_RESET")).toEqual({ ok: false });
    expect(await consumeToken(db, undefined, "PASSWORD_RESET")).toEqual({ ok: false });
  });
});

describe("passwords", () => {
  it("enforces length, byte-limit and obvious-bad rules", () => {
    expect(validateNewPassword("short")).toMatch(/at least 8/);
    expect(validateNewPassword("a".repeat(73))).toMatch(/72 bytes/);
    expect(validateNewPassword("é".repeat(37))).toMatch(/72 bytes/); // 74 bytes, only 37 chars
    expect(validateNewPassword("        ")).toMatch(/only spaces/);
    expect(validateNewPassword("me@x.com", "ME@x.com")).toMatch(/same as your email/);
    expect(validateNewPassword("correct horse battery")).toBeNull();
  });

  it("hashes at the current cost and verifies", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(bcrypt.getRounds(hash)).toBe(BCRYPT_COST);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("flags legacy low-cost hashes for upgrade", async () => {
    expect(needsRehash(bcrypt.hashSync("x", 10))).toBe(true);
    expect(needsRehash(await hashPassword("x"))).toBe(false);
    expect(needsRehash("not a hash")).toBe(false);
  });

  it("has a dummy hash at the real cost so unknown-email logins take as long as real ones", async () => {
    expect(bcrypt.getRounds(DUMMY_HASH)).toBe(BCRYPT_COST);
    expect(await verifyPassword("anything", DUMMY_HASH)).toBe(false);
  });

  it("normalises and sanity-checks emails", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
    expect(normalizeEmail(undefined)).toBe("");
    expect(isPlausibleEmail("a@b.co")).toBe(true);
    for (const bad of ["", "no-at", "a@b", "a b@c.com", `${"x".repeat(250)}@b.com`]) expect(isPlausibleEmail(bad)).toBe(false);
  });
});

describe("email", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it("delivers nothing and calls no network when no provider is configured", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetchSpy = vi.fn();
    expect(isEmailConfigured()).toBe(false);
    expect(await sendEmail({ to: "a@b.co", subject: "s", text: "t" }, fetchSpy)).toEqual({ delivered: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never writes the message (and its link) to production logs", async () => {
    delete process.env.RESEND_API_KEY;
    (process.env as Record<string, string>).NODE_ENV = "production";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await sendEmail({ to: "a@b.co", subject: "s", text: "https://x/reset?token=SECRET" });
    expect(info).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("SECRET");
  });

  it("posts to the provider with the API key when configured", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "PUGNA <no-reply@example.com>";
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    expect(await sendEmail({ to: "a@b.co", subject: "Hi", text: "Body" }, fetchSpy)).toEqual({ delivered: true });
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body)).toMatchObject({ to: ["a@b.co"], subject: "Hi" });
  });

  it("surfaces provider failures", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "x@example.com";
    await expect(sendEmail({ to: "a@b.co", subject: "s", text: "t" }, vi.fn().mockResolvedValue({ ok: false, status: 500 }))).rejects.toThrow(/500/);
  });

  it("builds links from configuration, never from request data", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://pugna.example/";
    expect(appUrl()).toBe("https://pugna.example");
  });

  it("templates carry the link and no account data beyond the recipient", () => {
    const reset = passwordResetEmail("a@b.co", "https://x/reset");
    expect(reset.text).toContain("https://x/reset");
    expect(reset.subject).toMatch(/Reset/);
    expect(verificationEmail("a@b.co", "https://x/verify").text).toContain("https://x/verify");
  });
});
