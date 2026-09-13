"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { revalidatePath } from "next/cache";
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

/** Self-serve password change — requires the current password, same bcrypt
 * check the Credentials provider itself uses at sign-in. */
export async function changePassword(formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "New passwords don't match." };
  }

  const user = await prisma.user.findUnique({ where: { id: actor.userId } });
  if (!user) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { ok: false, code: "FORBIDDEN", reason: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: actor.userId }, data: { passwordHash } });

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
