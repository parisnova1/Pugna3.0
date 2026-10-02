/**
 * Decides whether a signed-in session must be ended, given when it started and
 * the account's last credential change. Kept pure so every case is testable.
 *
 * - No credential change on record: nothing to revoke.
 * - Session began at/after the change: fine (it used the new password).
 * - Otherwise it predates the change and is revoked -- except the one session
 *   that performed a voluntary password change (`trustedSessionAt`), so the
 *   person who just changed it isn't thrown out. A session with no recorded
 *   start (issued before this check existed) can never match, so it is revoked.
 */
export function isSessionRevoked(input: {
  authAt: number | undefined;
  passwordChangedAt: Date | null;
  trustedSessionAt: Date | null;
}): boolean {
  if (!input.passwordChangedAt) return false;
  const authAt = input.authAt ?? 0;
  if (authAt >= input.passwordChangedAt.getTime()) return false;
  return !(input.trustedSessionAt !== null && authAt === input.trustedSessionAt.getTime());
}
