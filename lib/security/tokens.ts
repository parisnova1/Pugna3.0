import { createHash, randomBytes } from "node:crypto";

/** How long each emailed link stays valid. Reset links are short because they grant account takeover. */
export const TOKEN_TTL_MS = {
  PASSWORD_RESET: 30 * 60 * 1000,
  EMAIL_VERIFY: 24 * 60 * 60 * 1000,
} as const;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** 256 bits from the OS CSPRNG; only the hash is ever stored. */
export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

/** Cheap shape check so garbage input never reaches the database. */
export function looksLikeToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
