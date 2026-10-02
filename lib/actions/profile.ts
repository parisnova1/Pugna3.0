"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { POLICIES } from "@/lib/security/policies";
import { rateLimit } from "@/lib/security/rate-limit-db";
import { retryMessage } from "@/lib/security/rate-limit";
import { hashPassword, validateNewPassword, verifyPassword } from "@/lib/security/password";
import type { ActionResult } from "@/lib/actions/types";

/** Updates the account's display name — the one real, editable Profile field. */
export async function updateName(formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Name can't be empty." };

  await prisma.user.update({ where: { id: actor.userId }, data: { name } });

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Self-serve password change. Requires the current password. Sessions on other
 * devices are signed out (passwordChangedAt); this one is marked trusted so it
 * survives, without re-issuing a cookie mid-request. */
export async function changePassword(formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  // This form is a password-guessing oracle for anyone holding a stolen session.
  const limit = await rateLimit([{ policy: POLICIES.changePasswordUser, subject: actor.userId }]);
  if (!limit.ok) return { ok: false, code: "RATE_LIMITED", reason: retryMessage(limit.retryAfterSec) };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const user = await prisma.user.findUnique({ where: { id: actor.userId } });
  if (!user) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  const problem = validateNewPassword(newPassword, user.email);
  if (problem) return { ok: false, code: "VALIDATION_BLOCKED", reason: problem };
  if (newPassword !== confirmPassword) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "New passwords don't match." };
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return { ok: false, code: "FORBIDDEN", reason: "Current password is incorrect." };

  // A session from before this release has no sign-in time, so it can't be
  // singled out; it is simply signed out along with the rest.
  const currentSignIn = (await auth())?.user?.authAt;
  await prisma.user.update({
    where: { id: actor.userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt: new Date(),
      trustedSessionAt: currentSignIn ? new Date(currentSignIn) : null,
    },
  });

  return { ok: true };
}

/** Self-serve "Register as boxer" — creates a Boxer (Fighter) profile if missing. */
export async function becomeBoxer(): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  const existing = await prisma.fighterProfile.findUnique({ where: { userId: actor.userId } });
  if (!existing) {
    const user = await prisma.user.findUnique({ where: { id: actor.userId } });
    if (!user) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };
    await prisma.fighterProfile.create({
      data: { userId: actor.userId, displayName: user.name ?? user.email.split("@")[0] ?? user.email },
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Self-serve "Become an organizer" — creates the standalone Organizer profile if missing. */
export async function becomeOrganizer(): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  const existing = await prisma.organizerProfile.findUnique({ where: { userId: actor.userId } });
  if (!existing) {
    const user = await prisma.user.findUnique({ where: { id: actor.userId } });
    if (!user) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };
    await prisma.organizerProfile.create({
      data: { userId: actor.userId, displayName: user.name ?? user.email.split("@")[0] ?? user.email },
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
