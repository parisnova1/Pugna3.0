import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;
export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt silently ignores everything past 72 bytes, so refuse longer passwords instead of truncating them. */
export const PASSWORD_MAX_BYTES = 72;

/** Returns a user-facing reason the password is unacceptable, or null if it's fine. */
export function validateNewPassword(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return `Password must be ${PASSWORD_MAX_BYTES} bytes or fewer.`;
  if (!password.trim()) return "Password can't be only spaces.";
  if (email && password.toLowerCase() === email.toLowerCase()) return "Password can't be the same as your email.";
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Hashes created at an older (cheaper) cost get upgraded the next time their owner signs in. */
export function needsRehash(hash: string): boolean {
  try {
    return bcrypt.getRounds(hash) < BCRYPT_COST;
  } catch {
    return false;
  }
}

/**
 * A valid hash of a throwaway string, compared against when the email is
 * unknown so a failed login costs the same time whether or not the account
 * exists (otherwise response time leaks which emails are registered).
 */
export const DUMMY_HASH = "$2b$12$cSOWKPg6NT5OWVpmDsFnWu2CoHcqSH9VNGtJ9GTVB20A0zyryozJ.";

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}
