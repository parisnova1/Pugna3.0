"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import type { CheckInAttachedType, CheckInStatus } from "@prisma/client";
import { notifyMany } from "@/lib/actions/notify";
import { logScan } from "@/lib/actions/scanHistory";

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
    include: { event: true },
  });
  if (!bout) return { ok: false, code: "FORBIDDEN", reason: "You're not on this event's card." };

  await prisma.checkIn.upsert({
    where: { attachedType_attachedId_fighterId: { attachedType: "EVENT", attachedId: eventId, fighterId: fighter.id } },
    update: { status: "CHECKED_IN", checkedInAt: new Date() },
    create: { attachedType: "EVENT", attachedId: eventId, fighterId: fighter.id, status: "CHECKED_IN" },
  });

  await logScan({
    userId: actor.userId,
    kind: "EVENT",
    label: bout.event.name,
    detail: "Check in successful",
    href: bout.event.slug ? `/e/${bout.event.slug}` : `/checkin/event/${eventId}`,
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
    include: { session: { include: { club: true } } },
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

  await logScan({
    userId: actor.userId,
    kind: "SPARRING",
    label: participant.session.club.name,
    detail: "Check in successful",
    href: `/sparring/${sessionId}`,
  });

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

export async function notifyCheckInOpen(attachedType: CheckInAttachedType, attachedId: string): Promise<ActionResult> {
  const denied = await gateCheckInHost(attachedType, attachedId);
  if (denied) return denied;

  let fighterUserIds: string[] = [];
  let link: string;
  let place: string;

  if (attachedType === "EVENT") {
    const bouts = await prisma.bout.findMany({
      where: { eventId: attachedId },
      include: { fighterA: { include: { user: true } }, fighterB: { include: { user: true } } },
    });
    const event = await prisma.event.findUnique({ where: { id: attachedId } });
    fighterUserIds = [...new Set(bouts.flatMap((b) => [b.fighterA?.user.id, b.fighterB?.user.id]).filter((id): id is string => Boolean(id)))];
    link = `/checkin/event/${attachedId}`;
    place = event?.name ?? "the event";
  } else {
    const participants = await prisma.sparringParticipant.findMany({
      where: { sessionId: attachedId, status: "CONFIRMED" },
      include: { fighter: { include: { user: true } } },
    });
    const session = await prisma.sparringSession.findUnique({ where: { id: attachedId } });
    fighterUserIds = participants.map((p) => p.fighter.user.id);
    link = `/checkin/sparring/${attachedId}`;
    place = session?.gym ?? "the session";
  }

  await notifyMany(fighterUserIds, "CHECKIN_OPEN", `Check-in is now open for ${place}.`, link);

  return { ok: true };
}
