import type { AuthTokenType, PrismaClient } from "@prisma/client";
import { generateToken, hashToken, looksLikeToken, TOKEN_TTL_MS } from "@/lib/security/tokens";

// Accepts the real client, a transaction client, or a test double.
type TokenDb = Pick<PrismaClient, "authToken">;

/**
 * Creates a fresh one-time token and retires any still-outstanding one of the
 * same type, so only the newest emailed link ever works. Returns the raw token
 * (to put in the email); the database only ever sees its hash.
 */
export async function issueToken(db: TokenDb, userId: string, type: AuthTokenType, now: Date = new Date()): Promise<string> {
  const { raw, hash } = generateToken();
  await db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: now } });
  await db.authToken.create({
    data: { userId, type, tokenHash: hash, expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[type]) },
  });
  return raw;
}

/**
 * Spends a token. The check and the "mark used" are ONE conditional UPDATE,
 * so two simultaneous requests with the same link can't both succeed: exactly
 * one sees count === 1. Wrong type, expired, already used and unknown tokens
 * are indistinguishable to the caller.
 */
export async function consumeToken(
  db: TokenDb,
  raw: unknown,
  type: AuthTokenType,
  now: Date = new Date(),
): Promise<{ ok: true; userId: string } | { ok: false }> {
  if (!looksLikeToken(raw)) return { ok: false };
  const tokenHash = hashToken(raw);
  const claimed = await db.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) return { ok: false };
  const row = await db.authToken.findUnique({ where: { tokenHash }, select: { userId: true } });
  return row ? { ok: true, userId: row.userId } : { ok: false };
}
