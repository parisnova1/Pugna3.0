"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";

/** "Notify me when this fighter fights next" — a standing subscription scoped to one event, separate
 * from following the fighter. See startBout (lib/actions/live.ts) for where it fires. */
export async function toggleFighterNextBoutAlert(fighterId: string, eventId: string, slug: string): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "fighter.notifyNextBout");
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const existing = await prisma.fighterNextBoutAlert.findUnique({
    where: { userId_fighterId_eventId: { userId: actor!.userId, fighterId, eventId } },
  });

  if (existing) {
    await prisma.fighterNextBoutAlert.delete({ where: { id: existing.id } });
  } else {
    await prisma.fighterNextBoutAlert.create({ data: { userId: actor!.userId, fighterId, eventId } });
  }

  revalidatePath(`/e/${slug}`);
  return { ok: true };
}
