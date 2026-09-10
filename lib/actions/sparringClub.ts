"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { notify, notifyMany } from "@/lib/actions/notify";
import { clubAdminUserIds } from "@/lib/actions/sparring";

export async function inviteClub(sessionId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const session = await prisma.sparringSession.findUnique({ where: { id: sessionId } });
  if (!session) return { ok: false, code: "NOT_FOUND", reason: "Session not found." };

  const gate = can(actor, "club.admin", { clubId: session.clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };
  if (session.accessMode !== "INVITE") {
    return { ok: false, code: "CONFLICT", reason: "This session isn't in Invite mode." };
  }

  const invitedClubId = String(formData.get("clubId") ?? "");
  if (!invitedClubId || invitedClubId === session.clubId) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "Choose a different club to invite." };
  }
  const invitedClub = await prisma.club.findUnique({ where: { id: invitedClubId } });
  if (!invitedClub) return { ok: false, code: "NOT_FOUND", reason: "Club not found." };

  const existing = await prisma.sparringClubInvite.findUnique({
    where: { sessionId_invitedClubId: { sessionId, invitedClubId } },
  });
  if (existing) return { ok: false, code: "CONFLICT", reason: "That club has already been invited." };

  await prisma.sparringClubInvite.create({ data: { sessionId, invitedClubId } });

  await notifyMany(
    await clubAdminUserIds(invitedClubId),
    "SPARRING_CLUB_INVITED",
    `${session.gym} invited ${invitedClub.name} to spar.`,
    `/sparring/${sessionId}`,
  );

  revalidatePath(`/sparring/${sessionId}`);
  return { ok: true };
}

export async function respondToClubInvite(inviteId: string, accept: boolean): Promise<ActionResult> {
  const actor = await getActor();
  const invite = await prisma.sparringClubInvite.findUnique({
    where: { id: inviteId },
    include: { session: true, invitedClub: true },
  });
  if (!invite) return { ok: false, code: "NOT_FOUND", reason: "Invite not found." };

  const gate = can(actor, "club.admin", { clubId: invite.invitedClubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };
  if (invite.status !== "PENDING") return { ok: false, code: "CONFLICT", reason: "This invite was already answered." };

  await prisma.sparringClubInvite.update({
    where: { id: inviteId },
    data: { status: accept ? "ACCEPTED" : "DECLINED" },
  });

  await notifyMany(
    await clubAdminUserIds(invite.session.clubId),
    "SPARRING_CLUB_RESPONDED",
    accept
      ? `${invite.invitedClub.name} accepted your sparring invite.`
      : `${invite.invitedClub.name} declined your sparring invite.`,
    `/sparring/${invite.sessionId}`,
  );

  revalidatePath(`/sparring/${invite.sessionId}`);
  revalidatePath("/sparring/requests");
  return { ok: true };
}

export async function requestToJoinSession(sessionId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const session = await prisma.sparringSession.findUnique({ where: { id: sessionId }, include: { club: true } });
  if (!session) return { ok: false, code: "NOT_FOUND", reason: "Session not found." };
  if (session.accessMode !== "OPEN_TO_CLUBS") {
    return { ok: false, code: "CONFLICT", reason: "This session isn't open to club requests." };
  }

  const requestingClubId = String(formData.get("clubId") ?? "");
  const gate = can(actor, "club.admin", { clubId: requestingClubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };
  if (requestingClubId === session.clubId) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "You already host this session." };
  }

  const existing = await prisma.sparringClubRequest.findUnique({
    where: { sessionId_requestingClubId: { sessionId, requestingClubId } },
  });
  if (existing) return { ok: false, code: "CONFLICT", reason: "You already requested to join this session." };

  const requestingClub = await prisma.club.findUnique({ where: { id: requestingClubId } });
  if (!requestingClub) return { ok: false, code: "NOT_FOUND", reason: "Club not found." };

  await prisma.sparringClubRequest.create({ data: { sessionId, requestingClubId } });

  await notifyMany(
    await clubAdminUserIds(session.clubId),
    "SPARRING_CLUB_REQUESTED",
    `${requestingClub.name} requested to join sparring at ${session.gym}.`,
    `/sparring/${sessionId}`,
  );

  revalidatePath(`/sparring/${sessionId}`);
  return { ok: true };
}

export async function respondToClubRequest(requestId: string, accept: boolean): Promise<ActionResult> {
  const actor = await getActor();
  const request = await prisma.sparringClubRequest.findUnique({
    where: { id: requestId },
    include: { session: true, requestingClub: true },
  });
  if (!request) return { ok: false, code: "NOT_FOUND", reason: "Request not found." };

  const gate = can(actor, "club.admin", { clubId: request.session.clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };
  if (request.status !== "PENDING") return { ok: false, code: "CONFLICT", reason: "This request was already answered." };

  await prisma.sparringClubRequest.update({
    where: { id: requestId },
    data: { status: accept ? "ACCEPTED" : "DECLINED" },
  });

  await notifyMany(
    await clubAdminUserIds(request.requestingClubId),
    "SPARRING_CLUB_RESPONDED",
    accept
      ? `${request.session.gym} accepted your club into sparring.`
      : `${request.session.gym} declined your club's request to join sparring.`,
    `/sparring/${request.sessionId}`,
  );

  revalidatePath(`/sparring/${request.sessionId}`);
  revalidatePath("/sparring/requests");
  return { ok: true };
}

/** Is `clubId` cleared to nominate fighters onto this session, per its access mode? */
async function isClubAccepted(sessionId: string, accessMode: string, clubId: string): Promise<boolean> {
  if (accessMode === "INVITE") {
    const invite = await prisma.sparringClubInvite.findUnique({
      where: { sessionId_invitedClubId: { sessionId, invitedClubId: clubId } },
    });
    return invite?.status === "ACCEPTED";
  }
  if (accessMode === "OPEN_TO_CLUBS") {
    const request = await prisma.sparringClubRequest.findUnique({
      where: { sessionId_requestingClubId: { sessionId, requestingClubId: clubId } },
    });
    return request?.status === "ACCEPTED";
  }
  return false;
}

export async function nominateFighter(sessionId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const session = await prisma.sparringSession.findUnique({ where: { id: sessionId } });
  if (!session) return { ok: false, code: "NOT_FOUND", reason: "Session not found." };
  if (session.accessMode === "OPEN") {
    return { ok: false, code: "CONFLICT", reason: "Fighters join this session directly — no nomination needed." };
  }

  const clubId = String(formData.get("clubId") ?? "");
  const gate = can(actor, "club.admin", { clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const accepted = clubId === session.clubId || (await isClubAccepted(sessionId, session.accessMode, clubId));
  if (!accepted) return { ok: false, code: "FORBIDDEN", reason: "Your club isn't cleared to nominate onto this session." };

  const fighterId = String(formData.get("fighterId") ?? "");
  const weightGroupId = String(formData.get("weightGroupId") ?? "") || null;
  const fighter = await prisma.fighterProfile.findUnique({ where: { id: fighterId } });
  if (!fighter || fighter.clubId !== clubId) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "Choose a fighter from your own roster." };
  }

  const existingParticipant = await prisma.sparringParticipant.findUnique({
    where: { sessionId_fighterId: { sessionId, fighterId } },
  });
  if (existingParticipant) return { ok: false, code: "CONFLICT", reason: "That fighter already has a seat on this session." };

  const existingNomination = await prisma.sparringNomination.findUnique({
    where: { sessionId_fighterId: { sessionId, fighterId } },
  });
  if (existingNomination && existingNomination.status === "PENDING") {
    return { ok: false, code: "CONFLICT", reason: "That fighter is already nominated." };
  }

  await prisma.sparringNomination.upsert({
    where: { sessionId_fighterId: { sessionId, fighterId } },
    update: { status: "PENDING", weightGroupId, nominatingClubId: clubId, nominatedByUserId: actor!.userId },
    create: { sessionId, fighterId, weightGroupId, nominatingClubId: clubId, nominatedByUserId: actor!.userId },
  });

  await notify(fighter.userId, "SPARRING_NOMINATED", `Your club nominated you for sparring at ${session.gym}.`, `/sparring/${sessionId}`);

  revalidatePath(`/sparring/${sessionId}`);
  return { ok: true };
}

export async function respondToNomination(nominationId: string, accept: boolean): Promise<ActionResult> {
  const actor = await getActor();
  const nomination = await prisma.sparringNomination.findUnique({
    where: { id: nominationId },
    include: { session: true, fighter: true, nominatingClub: true },
  });
  if (!nomination) return { ok: false, code: "NOT_FOUND", reason: "Nomination not found." };

  const gate = can(actor, "club.admin", { clubId: nomination.session.clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };
  if (nomination.status !== "PENDING") return { ok: false, code: "CONFLICT", reason: "This nomination was already answered." };

  if (accept) {
    await prisma.$transaction([
      prisma.sparringNomination.update({ where: { id: nominationId }, data: { status: "ACCEPTED" } }),
      prisma.sparringParticipant.create({
        data: {
          sessionId: nomination.sessionId,
          fighterId: nomination.fighterId,
          weightGroupId: nomination.weightGroupId,
          status: "CONFIRMED",
        },
      }),
    ]);
    await notify(
      nomination.fighter.userId,
      "SPARRING_ACCEPTED",
      `You're confirmed for sparring at ${nomination.session.gym}.`,
      `/sparring/${nomination.sessionId}`,
    );
  } else {
    await prisma.sparringNomination.update({ where: { id: nominationId }, data: { status: "DECLINED" } });
    await notify(
      nomination.fighter.userId,
      "SPARRING_DECLINED",
      `Your nomination to spar at ${nomination.session.gym} was declined.`,
      `/sparring/${nomination.sessionId}`,
    );
  }

  await notifyMany(
    await clubAdminUserIds(nomination.nominatingClubId),
    "SPARRING_NOMINATION_RESPONDED",
    accept
      ? `${nomination.fighter.displayName} was accepted for sparring at ${nomination.session.gym}.`
      : `${nomination.fighter.displayName}'s nomination for ${nomination.session.gym} was declined.`,
    `/sparring/${nomination.sessionId}`,
  );

  revalidatePath(`/sparring/${nomination.sessionId}`);
  revalidatePath("/sparring/requests");
  return { ok: true };
}

export async function withdrawNomination(nominationId: string): Promise<ActionResult> {
  const actor = await getActor();
  const nomination = await prisma.sparringNomination.findUnique({ where: { id: nominationId } });
  if (!nomination) return { ok: false, code: "NOT_FOUND", reason: "Nomination not found." };

  const gate = can(actor, "club.admin", { clubId: nomination.nominatingClubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };
  if (nomination.status !== "PENDING") return { ok: false, code: "CONFLICT", reason: "This nomination can no longer be withdrawn." };

  await prisma.sparringNomination.update({ where: { id: nominationId }, data: { status: "WITHDRAWN" } });

  revalidatePath(`/sparring/${nomination.sessionId}`);
  revalidatePath("/sparring/requests");
  return { ok: true };
}
