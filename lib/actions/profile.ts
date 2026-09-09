"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";

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
