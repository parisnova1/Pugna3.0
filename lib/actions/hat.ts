"use server";

import type { Hat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; code: string; reason: string };

export async function switchHat(targetHat: Hat): Promise<ActionResult> {
  const actor = await getActor();
  const result = can(actor, "hat.switch", { targetHat });
  if (!result.allowed) return { ok: false, code: result.code, reason: result.reason };

  await prisma.user.update({
    where: { id: actor!.userId },
    data: { activeHat: targetHat },
  });

  // Force the JWT callback to re-read hats/hostEventIds/adminClubIds on next request.
  revalidatePath("/", "layout");
  return { ok: true };
}
