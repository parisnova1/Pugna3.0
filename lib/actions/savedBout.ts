"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";

export async function toggleSavedBout(boutId: string): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "bout.save");
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const existing = await prisma.savedBout.findUnique({
    where: { userId_boutId: { userId: actor!.userId, boutId } },
  });

  if (existing) {
    await prisma.savedBout.delete({ where: { id: existing.id } });
  } else {
    await prisma.savedBout.create({ data: { userId: actor!.userId, boutId } });
  }

  revalidatePath("/you/saved");
  return { ok: true };
}
