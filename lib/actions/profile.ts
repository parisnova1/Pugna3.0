"use server";

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
