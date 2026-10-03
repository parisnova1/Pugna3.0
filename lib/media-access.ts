import { prisma } from "@/lib/prisma";
import { can, type Actor } from "@/lib/rbac";
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
