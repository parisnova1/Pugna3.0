"use server";

import type { Hat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/hat";

/**
 * Self-serve hat grant (simpler operational path — blueprint has no explicit
 * onboarding wizard in its own route table beyond the /club -> Organizer
 * interstitial, which is handled separately in the club-hosting flow).
 */
export async function grantHat(hat: Hat): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  const user = await prisma.user.findUnique({ where: { id: actor.userId } });
  if (!user) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  if (!user.hats.includes(hat)) {
    await prisma.user.update({
      where: { id: actor.userId },
      data: { hats: { set: [...user.hats, hat] }, activeHat: hat },
    });
  } else {
    await prisma.user.update({ where: { id: actor.userId }, data: { activeHat: hat } });
  }

  if (hat === "FIGHTER") {
    const existingProfile = await prisma.fighterProfile.findUnique({ where: { userId: actor.userId } });
    if (!existingProfile) {
      await prisma.fighterProfile.create({
        data: { userId: actor.userId, displayName: user.name ?? user.email.split("@")[0] ?? user.email },
      });
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
