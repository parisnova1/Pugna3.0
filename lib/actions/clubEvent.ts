"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { notifyMany } from "@/lib/actions/notify";
import { clubAdminUserIds } from "@/lib/actions/sparring";

/**
 * Organizer <-> Club, event-scoped — mirrors lib/actions/sparringClub.ts's
 * two-direction invite/request pattern exactly. Accepting either direction
 * only creates a ClubEventParticipation row; it never touches Nomination —
 * the club still decides which of its own athletes actually compete.
 */

export async function inviteClubToEvent(eventId: string, clubId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "event.manageClubs", { eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const [event, club] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId } }),
    prisma.club.findUnique({ where: { id: clubId } }),
  ]);
  if (!event) return { ok: false, code: "NOT_FOUND", reason: "Event not found." };
  if (!club) return { ok: false, code: "NOT_FOUND", reason: "Club not found." };

  const existing = await prisma.clubEventInvite.findUnique({
    where: { eventId_invitedClubId: { eventId, invitedClubId: clubId } },
  });
  if (existing) return { ok: false, code: "CONFLICT", reason: "That club has already been invited to this event." };

  const message = String(formData.get("message") ?? "").trim() || null;

  await prisma.clubEventInvite.create({
    data: { eventId, invitedClubId: clubId, invitedById: actor!.userId, message },
  });

  await notifyMany(
    await clubAdminUserIds(clubId),
    "CLUB_EVENT_INVITED",
    `${event.name} invited ${club.name} to participate.`,
    "/club/requests",
  );

  revalidatePath(`/clubs/${clubId}`);
  revalidatePath("/clubs");
  return { ok: true };
}

export async function cancelClubEventInvite(inviteId: string): Promise<ActionResult> {
  const actor = await getActor();
  const invite = await prisma.clubEventInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return { ok: false, code: "NOT_FOUND", reason: "Invitation not found." };

  const gate = can(actor, "event.manageClubs", { eventId: invite.eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };
  if (invite.status !== "PENDING") return { ok: false, code: "CONFLICT", reason: "This invitation was already answered." };

  await prisma.clubEventInvite.delete({ where: { id: inviteId } });

  revalidatePath("/clubs");
  return { ok: true };
}

export async function respondToClubEventInvite(inviteId: string, accept: boolean): Promise<ActionResult> {
  const actor = await getActor();
  const invite = await prisma.clubEventInvite.findUnique({
    where: { id: inviteId },
    include: { event: true, invitedClub: true },
  });
  if (!invite) return { ok: false, code: "NOT_FOUND", reason: "Invitation not found." };

  const gate = can(actor, "club.admin", { clubId: invite.invitedClubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };
  if (invite.status !== "PENDING") return { ok: false, code: "CONFLICT", reason: "This invitation was already answered." };

  await prisma.$transaction([
    prisma.clubEventInvite.update({ where: { id: inviteId }, data: { status: accept ? "ACCEPTED" : "DECLINED" } }),
    ...(accept
      ? [
          prisma.clubEventParticipation.upsert({
            where: { eventId_clubId: { eventId: invite.eventId, clubId: invite.invitedClubId } },
            update: {},
            create: { eventId: invite.eventId, clubId: invite.invitedClubId },
          }),
        ]
      : []),
  ]);

  const organizerAdminIds = (await prisma.eventHostMember.findMany({ where: { eventId: invite.eventId }, select: { userId: true } })).map(
    (m) => m.userId,
  );
  await notifyMany(
    organizerAdminIds,
    "CLUB_EVENT_REQUEST_RESPONDED",
    accept
      ? `${invite.invitedClub.name} accepted your invitation to ${invite.event.name}.`
      : `${invite.invitedClub.name} declined your invitation to ${invite.event.name}.`,
    `/host/events/${invite.eventId}/entries`,
  );

  revalidatePath("/club/requests");
  revalidatePath("/clubs");
  revalidatePath(`/host/events/${invite.eventId}/entries`);
  return { ok: true };
}

export async function requestClubForEvent(eventId: string, clubId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "club.admin", { clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const [event, club] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId } }),
    prisma.club.findUnique({ where: { id: clubId } }),
  ]);
  if (!event) return { ok: false, code: "NOT_FOUND", reason: "Event not found." };
  if (!club) return { ok: false, code: "NOT_FOUND", reason: "Club not found." };

  const existing = await prisma.clubEventRequest.findUnique({
    where: { eventId_requestingClubId: { eventId, requestingClubId: clubId } },
  });
  if (existing) return { ok: false, code: "CONFLICT", reason: "You already requested to join this event." };

  const message = String(formData.get("message") ?? "").trim() || null;

  await prisma.clubEventRequest.create({
    data: { eventId, requestingClubId: clubId, requestedById: actor!.userId, message },
  });

  const organizerAdminIds = (await prisma.eventHostMember.findMany({ where: { eventId }, select: { userId: true } })).map((m) => m.userId);
  await notifyMany(
    organizerAdminIds,
    "CLUB_EVENT_INVITED",
    `${club.name} requested to participate in ${event.name}.`,
    `/host/events/${eventId}/entries`,
  );

  revalidatePath("/club/requests");
  return { ok: true };
}

export async function respondToClubEventRequest(requestId: string, accept: boolean): Promise<ActionResult> {
  const actor = await getActor();
  const request = await prisma.clubEventRequest.findUnique({
    where: { id: requestId },
    include: { event: true, requestingClub: true },
  });
  if (!request) return { ok: false, code: "NOT_FOUND", reason: "Request not found." };

  const gate = can(actor, "event.manageClubs", { eventId: request.eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };
  if (request.status !== "PENDING") return { ok: false, code: "CONFLICT", reason: "This request was already answered." };

  await prisma.$transaction([
    prisma.clubEventRequest.update({ where: { id: requestId }, data: { status: accept ? "ACCEPTED" : "DECLINED" } }),
    ...(accept
      ? [
          prisma.clubEventParticipation.upsert({
            where: { eventId_clubId: { eventId: request.eventId, clubId: request.requestingClubId } },
            update: {},
            create: { eventId: request.eventId, clubId: request.requestingClubId },
          }),
        ]
      : []),
  ]);

  await notifyMany(
    await clubAdminUserIds(request.requestingClubId),
    "CLUB_EVENT_REQUEST_RESPONDED",
    accept
      ? `${request.event.name} accepted your club's request to participate.`
      : `${request.event.name} declined your club's request to participate.`,
    "/club/requests",
  );

  revalidatePath("/club/requests");
  revalidatePath("/clubs");
  revalidatePath(`/host/events/${request.eventId}/entries`);
  return { ok: true };
}
