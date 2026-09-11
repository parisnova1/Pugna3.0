"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";

export async function toggleFighterFollow(fighterId: string): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "fighter.follow");
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const existing = await prisma.fighterFollow.findUnique({
    where: { userId_fighterId: { userId: actor!.userId, fighterId } },
  });

  if (existing) {
    await prisma.fighterFollow.delete({ where: { id: existing.id } });
  } else {
    await prisma.fighterFollow.create({ data: { userId: actor!.userId, fighterId } });
  }

  revalidatePath(`/fighters/${fighterId}`);
  return { ok: true };
}
