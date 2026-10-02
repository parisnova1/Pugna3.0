"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn as nextAuthSignIn } from "@/lib/auth";
import { getActor } from "@/lib/actor";
import { sanitizeReturnTo } from "@/lib/rbac";
import { clientIp } from "@/lib/security/client-ip";
import { POLICIES, loginChecks } from "@/lib/security/policies";
import { rateLimit, rateLimited } from "@/lib/security/rate-limit-db";
import { retryMessage } from "@/lib/security/rate-limit";
import { hashToken, looksLikeToken } from "@/lib/security/tokens";
import { consumeToken, issueToken } from "@/lib/security/auth-tokens";
import { hashPassword, isPlausibleEmail, normalizeEmail, validateNewPassword } from "@/lib/security/password";
import { appUrl, passwordResetEmail, sendEmail, verificationEmail, type EmailMessage } from "@/lib/security/email";

export type AuthActionResult = { ok: true; message?: string } | { ok: false; error: string };

const fail = (error: string): AuthActionResult => ({ ok: false, error });

async function requestIp(): Promise<string> {
  return clientIp(await headers());
}

/** Sends after the response is returned, so mail latency can't be used to tell real accounts from fake ones. */
function sendLater(message: EmailMessage) {
  after(async () => {
    try {
      await sendEmail(message);
    } catch (error) {
      console.error("[auth] email delivery failed", error);
    }
  });
}

export async function registerAction(_prev: AuthActionResult | null, formData: FormData): Promise<AuthActionResult> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || null;
  const returnTo = sanitizeReturnTo(String(formData.get("returnTo") ?? ""));

  const limit = await rateLimit([
    { policy: POLICIES.registerIp, subject: await requestIp() },
    { policy: POLICIES.registerEmail, subject: email || "none" },
  ]);
  if (!limit.ok) return fail(retryMessage(limit.retryAfterSec));

  if (!isPlausibleEmail(email)) return fail("Enter a valid email address.");
  const passwordProblem = validateNewPassword(password, email);
  if (passwordProblem) return fail(passwordProblem);

  // Registration necessarily says when an address is taken (the form signs the
  // new user straight in); the per-IP and per-address limits above are what
  // stop that being used to harvest which emails have accounts.
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return fail("An account with that email already exists.");
  }

  let userId: string;
  try {
    const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(password), name } });
    userId = user.id;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return fail("An account with that email already exists.");
    throw error;
  }

  const token = await issueToken(prisma, userId, "EMAIL_VERIFY");
  sendLater(verificationEmail(email, `${appUrl()}/account/verify?token=${token}`));

  return credentialsSignIn(email, password, returnTo);
}

export async function signInAction(_prev: AuthActionResult | null, formData: FormData): Promise<AuthActionResult> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const returnTo = sanitizeReturnTo(String(formData.get("returnTo") ?? ""));
  return credentialsSignIn(email, password, returnTo);
}

async function credentialsSignIn(email: string, password: string, returnTo: string): Promise<AuthActionResult> {
  try {
    await nextAuthSignIn("credentials", { email, password, redirectTo: returnTo });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      // The limiter lives in authorize() and can only say "no" -- ask it why,
      // so a locked-out user sees a reason instead of a misleading "wrong password".
      if (await rateLimited(loginChecks(email, await requestIp()))) {
        return fail("Too many sign-in attempts. Try again in a few minutes.");
      }
      return fail("Invalid email or password.");
    }
    // NextAuth throws a NEXT_REDIRECT "error" on success — rethrow so Next.js can navigate.
    throw error;
  }
}

const RESET_REQUESTED: AuthActionResult = {
  ok: true,
  message: "If an account exists for that email, we've sent a reset link. It works once and expires in 30 minutes.",
};

export async function requestPasswordReset(_prev: AuthActionResult | null, formData: FormData): Promise<AuthActionResult> {
  const email = normalizeEmail(formData.get("email"));

  const limit = await rateLimit([
    { policy: POLICIES.forgotIp, subject: await requestIp() },
    { policy: POLICIES.forgotEmail, subject: email || "none" },
  ]);
  if (!limit.ok) return fail(retryMessage(limit.retryAfterSec));
  if (!isPlausibleEmail(email)) return fail("Enter a valid email address.");

  // Identical response whether or not the account exists, so this form can't
  // be used to discover who has one.
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    const token = await issueToken(prisma, user.id, "PASSWORD_RESET");
    sendLater(passwordResetEmail(email, `${appUrl()}/account/reset?token=${token}`));
  }
  return RESET_REQUESTED;
}

const INVALID_LINK = "This link is invalid or has expired. Request a new one.";

export async function resetPassword(_prev: AuthActionResult | null, formData: FormData): Promise<AuthActionResult> {
  const token = formData.get("token");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const limit = await rateLimit([
    { policy: POLICIES.resetIp, subject: await requestIp() },
    { policy: POLICIES.resetToken, subject: hashToken(String(token ?? "")) },
  ]);
  if (!limit.ok) return fail(retryMessage(limit.retryAfterSec));

  if (!looksLikeToken(token)) return fail(INVALID_LINK);
  if (password !== confirm) return fail("Passwords don't match.");
  const passwordProblem = validateNewPassword(password);
  if (passwordProblem) return fail(passwordProblem);

  const passwordHash = await hashPassword(password);

  // Spending the token and changing the password are one transaction: a link
  // is never burned without the password changing, nor the reverse.
  const done = await prisma.$transaction(async (tx) => {
    const consumed = await consumeToken(tx, token, "PASSWORD_RESET");
    if (!consumed.ok) return false;
    const now = new Date();
    await tx.user.update({ where: { id: consumed.userId }, data: { passwordHash, passwordChangedAt: now, trustedSessionAt: null } });
    // Getting the link proves control of the mailbox.
    await tx.user.updateMany({ where: { id: consumed.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
    await tx.authToken.updateMany({
      where: { userId: consumed.userId, type: "PASSWORD_RESET", usedAt: null },
      data: { usedAt: now },
    });
    return true;
  });

  if (!done) return fail(INVALID_LINK);
  return { ok: true, message: "Password updated. Every other signed-in session was signed out." };
}

export async function verifyEmail(_prev: AuthActionResult | null, formData: FormData): Promise<AuthActionResult> {
  const token = formData.get("token");

  const limit = await rateLimit([{ policy: POLICIES.verifyIp, subject: await requestIp() }]);
  if (!limit.ok) return fail(retryMessage(limit.retryAfterSec));

  const done = await prisma.$transaction(async (tx) => {
    const consumed = await consumeToken(tx, token, "EMAIL_VERIFY");
    if (!consumed.ok) return false;
    await tx.user.updateMany({ where: { id: consumed.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
    return true;
  });

  if (!done) return fail("This confirmation link is invalid or has expired. Sign in and request a new one.");
  revalidatePath("/", "layout"); // drop the "confirm your email" banner straight away
  return { ok: true, message: "Email confirmed. You're all set." };
}

export async function resendVerification(): Promise<AuthActionResult> {
  const actor = await getActor();
  if (!actor) return fail("Sign in required.");

  const limit = await rateLimit([{ policy: POLICIES.resendUser, subject: actor.userId }]);
  if (!limit.ok) return fail(retryMessage(limit.retryAfterSec));

  const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { email: true, emailVerifiedAt: true } });
  if (!user) return fail("Sign in required.");
  if (user.emailVerifiedAt) return { ok: true, message: "Your email is already confirmed." };

  const token = await issueToken(prisma, actor.userId, "EMAIL_VERIFY");
  sendLater(verificationEmail(user.email, `${appUrl()}/account/verify?token=${token}`));
  return { ok: true, message: "Confirmation email sent. Check your inbox." };
}
