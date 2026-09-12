"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can, type Actor } from "@/lib/rbac";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import type { MediaAttachedType } from "@prisma/client";

/** Resolves the real owner behind a polymorphic (attachedType, attachedId) pair and checks capability. */
export async function canManageMedia(
  actor: Actor,
  attachedType: MediaAttachedType,
  attachedId: string,
): Promise<ActionResult> {
  if (attachedType === "EVENT") {
    const gate = can(actor, "event.edit", { eventId: attachedId });
    return gate.allowed ? { ok: true } : { ok: false, code: gate.code, reason: gate.reason };
  }

  if (attachedType === "BOUT") {
    const bout = await prisma.bout.findUnique({ where: { id: attachedId }, select: { eventId: true } });
    if (!bout) return { ok: false, code: "NOT_FOUND", reason: "Bout not found." };
    const gate = can(actor, "event.edit", { eventId: bout.eventId });
    return gate.allowed ? { ok: true } : { ok: false, code: gate.code, reason: gate.reason };
  }

  if (attachedType === "CLUB") {
    const gate = can(actor, "club.admin", { clubId: attachedId });
    return gate.allowed ? { ok: true } : { ok: false, code: gate.code, reason: gate.reason };
  }

  if (attachedType === "FIGHTER") {
    const fighter = await prisma.fighterProfile.findUnique({ where: { id: attachedId }, select: { userId: true } });
    if (!fighter) return { ok: false, code: "NOT_FOUND", reason: "Fighter not found." };
    if (!actor || fighter.userId !== actor.userId) {
      return { ok: false, code: "FORBIDDEN", reason: "Only this boxer can manage their profile media." };
    }
    return { ok: true };
  }

  const session = await prisma.sparringSession.findUnique({ where: { id: attachedId }, select: { clubId: true } });
  if (!session) return { ok: false, code: "NOT_FOUND", reason: "Sparring session not found." };
  const gate = can(actor, "club.admin", { clubId: session.clubId });
  return gate.allowed ? { ok: true } : { ok: false, code: gate.code, reason: gate.reason };
}

export async function deleteMedia(mediaId: string): Promise<ActionResult> {
  const actor = await getActor();
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) return { ok: false, code: "NOT_FOUND", reason: "Media not found." };

  const gate = await canManageMedia(actor, media.attachedType, media.attachedId);
  if (!gate.ok) return gate;

  await prisma.media.delete({ where: { id: mediaId } });
  await del(media.url).catch(() => {});

  revalidatePath("/", "layout");
  return { ok: true };
}
