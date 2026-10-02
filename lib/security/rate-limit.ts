import { createHash } from "node:crypto";

/**
 * Fixed-window rate limiting with a pluggable store. Production uses the
 * Postgres-backed store in rate-limit-db.ts (serverless instances don't share
 * memory, so a process-local counter would be trivially bypassed); tests use
 * the in-memory store below.
 */

export type Policy = { name: string; limit: number; windowSec: number };
export type Counter = { count: number; resetAt: Date };

export type RateLimitStore = {
  /** Atomically count one attempt in the key's current window (opening a new window if expired). */
  hit(key: string, windowSec: number): Promise<Counter>;
  /** Read the current window without counting an attempt. */
  peek(key: string): Promise<Counter | null>;
  reset(key: string): Promise<void>;
};

export type Check = { policy: Policy; subject: string };
export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number; unavailable?: boolean };

/** Subjects (emails, IPs, tokens) are hashed so the table never holds personal data. */
export function limiterKey(policy: Policy, subject: string): string {
  return `${policy.name}:${createHash("sha256").update(subject).digest("hex").slice(0, 32)}`;
}

const secondsUntil = (resetAt: Date, nowMs: number) => Math.max(1, Math.ceil((resetAt.getTime() - nowMs) / 1000));

/**
 * Counts one attempt against every check and blocks if ANY is over its limit.
 * Fails closed: if the store errors, the attempt is refused rather than
 * silently unlimited -- an attacker must not be able to disable the limiter
 * by degrading it.
 */
export async function consume(store: RateLimitStore, checks: Check[], now: () => number = Date.now): Promise<RateLimitResult> {
  try {
    const counters = await Promise.all(checks.map((c) => store.hit(limiterKey(c.policy, c.subject), c.policy.windowSec)));
    let blocked = false;
    let retryAfterSec = 0;
    counters.forEach((counter, i) => {
      if (counter.count > checks[i]!.policy.limit) {
        blocked = true;
        retryAfterSec = Math.max(retryAfterSec, secondsUntil(counter.resetAt, now()));
      }
    });
    return blocked ? { ok: false, retryAfterSec } : { ok: true };
  } catch (error) {
    console.error("[rate-limit] store failure -- failing closed", error);
    return { ok: false, retryAfterSec: 60, unavailable: true };
  }
}

/** True when the next attempt on any check would be refused (does not count an attempt). */
export async function isLimited(store: RateLimitStore, checks: Check[]): Promise<boolean> {
  try {
    const counters = await Promise.all(checks.map((c) => store.peek(limiterKey(c.policy, c.subject))));
    return counters.some((counter, i) => counter !== null && counter.count >= checks[i]!.policy.limit);
  } catch {
    return true;
  }
}

export async function resetCheck(store: RateLimitStore, check: Check): Promise<void> {
  await store.reset(limiterKey(check.policy, check.subject));
}

export function retryMessage(retryAfterSec: number): string {
  const minutes = Math.ceil(retryAfterSec / 60);
  return minutes <= 1 ? "Too many attempts. Try again in a minute." : `Too many attempts. Try again in ${minutes} minutes.`;
}

export function createMemoryStore(now: () => number = Date.now): RateLimitStore {
  const buckets = new Map<string, Counter>();
  const live = (key: string): Counter | undefined => {
    const bucket = buckets.get(key);
    if (bucket && bucket.resetAt.getTime() <= now()) {
      buckets.delete(key);
      return undefined;
    }
    return bucket;
  };
  return {
    async hit(key, windowSec) {
      const existing = live(key);
      if (existing) {
        existing.count += 1;
        return { ...existing };
      }
      const fresh = { count: 1, resetAt: new Date(now() + windowSec * 1000) };
      buckets.set(key, fresh);
      return { ...fresh };
    },
    async peek(key) {
      const bucket = live(key);
      return bucket ? { ...bucket } : null;
    },
    async reset(key) {
      buckets.delete(key);
    },
  };
}
