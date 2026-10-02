import type { Check, Policy } from "@/lib/security/rate-limit";

const MIN = 60;
const HOUR = 3600;

/**
 * Every limit in one reviewable place. Login is limited on three axes so an
 * attacker can neither hammer one account (identity = email+IP, email) nor
 * spray many accounts from one address (ip), while a victim can't be locked
 * out of their own account by someone else's IP alone.
 */
export const POLICIES = {
  loginIp: { name: "login:ip", limit: 30, windowSec: 15 * MIN },
  loginIdentity: { name: "login:id", limit: 5, windowSec: 15 * MIN },
  loginEmail: { name: "login:email", limit: 20, windowSec: HOUR },

  registerIp: { name: "register:ip", limit: 5, windowSec: HOUR },
  registerEmail: { name: "register:email", limit: 3, windowSec: HOUR },

  forgotIp: { name: "forgot:ip", limit: 5, windowSec: HOUR },
  forgotEmail: { name: "forgot:email", limit: 3, windowSec: HOUR },

  resetIp: { name: "reset:ip", limit: 10, windowSec: HOUR },
  resetToken: { name: "reset:token", limit: 5, windowSec: HOUR },

  verifyIp: { name: "verify:ip", limit: 20, windowSec: HOUR },
  resendUser: { name: "resend:user", limit: 3, windowSec: HOUR },

  changePasswordUser: { name: "chpw:user", limit: 5, windowSec: 15 * MIN },

  uploadUser: { name: "upload:user", limit: 30, windowSec: 10 * MIN },

  codeLookupIp: { name: "code:ip", limit: 60, windowSec: 5 * MIN },
  checkInUser: { name: "checkin:user", limit: 30, windowSec: 10 * MIN },
} as const satisfies Record<string, Policy>;

/** The three counters every password sign-in attempt is charged against. */
export function loginChecks(email: string, ip: string): Check[] {
  return [
    { policy: POLICIES.loginIp, subject: ip },
    { policy: POLICIES.loginIdentity, subject: `${email}|${ip}` },
    { policy: POLICIES.loginEmail, subject: email },
  ];
}
