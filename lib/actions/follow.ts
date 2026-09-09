"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";

export async function toggleFollow(eventId: string, slug: string): Promise<ActionResult> {
  const actor = await getActor();
  const result = can(actor, "event.follow");
  if (!result.allowed) return { ok: false, code: result.code, reason: result.reason };

  const existing = await prisma.follow.findUnique({
    where: { userId_eventId: { userId: actor!.userId, eventId } },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
  } else {
    await prisma.follow.create({ data: { userId: actor!.userId, eventId } });
  }

  revalidatePath(`/e/${slug}`);
  return { ok: true };
}
