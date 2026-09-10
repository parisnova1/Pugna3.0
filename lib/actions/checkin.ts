"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import type { CheckInAttachedType, CheckInStatus } from "@prisma/client";

async function getOwnFighter(userId: string) {
  return prisma.fighterProfile.findUnique({ where: { userId } });
}

export async function checkInToEvent(eventId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  const fighter = await getOwnFighter(actor.userId);
  if (!fighter) return { ok: false, code: "CONTEXT_REQUIRED", reason: "Register as a fighter first." };

  const bout = await prisma.bout.findFirst({
    where: { eventId, OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }] },
  });
  if (!bout) return { ok: false, code: "FORBIDDEN", reason: "You're not on this event's card." };

  await prisma.checkIn.upsert({
    where: { attachedType_attachedId_fighterId: { attachedType: "EVENT", attachedId: eventId, fighterId: fighter.id } },
    update: { status: "CHECKED_IN", checkedInAt: new Date() },
    create: { attachedType: "EVENT", attachedId: eventId, fighterId: fighter.id, status: "CHECKED_IN" },
  });

  revalidatePath(`/host/events/${eventId}/checkin`);
  return { ok: true };
}

export async function checkInToSparring(sessionId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  const fighter = await getOwnFighter(actor.userId);
  if (!fighter) return { ok: false, code: "CONTEXT_REQUIRED", reason: "Register as a fighter first." };

  const participant = await prisma.sparringParticipant.findUnique({
    where: { sessionId_fighterId: { sessionId, fighterId: fighter.id } },
  });
  if (!participant || participant.status !== "CONFIRMED") {
    return { ok: false, code: "FORBIDDEN", reason: "You're not confirmed for this session." };
  }

  await Promise.all([
    prisma.checkIn.upsert({
      where: { attachedType_attachedId_fighterId: { attachedType: "SPARRING_SESSION", attachedId: sessionId, fighterId: fighter.id } },
      update: { status: "CHECKED_IN", checkedInAt: new Date() },
      create: { attachedType: "SPARRING_SESSION", attachedId: sessionId, fighterId: fighter.id, status: "CHECKED_IN" },
    }),
    prisma.sparringParticipant.update({ where: { id: participant.id }, data: { status: "CHECKED_IN" } }),
  ]);

  revalidatePath(`/sparring/${sessionId}`);
  return { ok: true };
}

async function gateCheckInHost(attachedType: CheckInAttachedType, attachedId: string): Promise<ActionResult | null> {
  const actor = await getActor();
  if (attachedType === "EVENT") {
    const gate = can(actor, "event.edit", { eventId: attachedId });
    return gate.allowed ? null : { ok: false, code: gate.code, reason: gate.reason };
  }
  const session = await prisma.sparringSession.findUnique({ where: { id: attachedId }, select: { clubId: true } });
  if (!session) return { ok: false, code: "NOT_FOUND", reason: "Session not found." };
  const gate = can(actor, "club.admin", { clubId: session.clubId });
  return gate.allowed ? null : { ok: false, code: gate.code, reason: gate.reason };
}

export async function setCheckInStatus(
  attachedType: CheckInAttachedType,
  attachedId: string,
  fighterId: string,
  status: CheckInStatus,
): Promise<ActionResult> {
  const denied = await gateCheckInHost(attachedType, attachedId);
  if (denied) return denied;

  await prisma.checkIn.upsert({
    where: { attachedType_attachedId_fighterId: { attachedType, attachedId, fighterId } },
    update: { status, checkedInAt: new Date() },
    create: { attachedType, attachedId, fighterId, status },
  });

  if (attachedType === "EVENT") revalidatePath(`/host/events/${attachedId}/checkin`);
  else revalidatePath(`/sparring/${attachedId}`);
  return { ok: true };
}
