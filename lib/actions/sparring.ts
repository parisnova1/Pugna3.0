"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/actions/types";
import { notify, notifyMany } from "@/lib/actions/notify";

async function getOwnFighter(userId: string) {
  return prisma.fighterProfile.findUnique({ where: { userId } });
}

export async function clubAdminUserIds(clubId: string): Promise<string[]> {
  const admins = await prisma.clubAdmin.findMany({ where: { clubId }, select: { userId: true } });
  return admins.map((a) => a.userId);
}

export async function createSparringSession(formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const clubId = String(formData.get("clubId") ?? "");
  const gate = can(actor, "club.admin", { clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const sport = String(formData.get("sport") ?? "Boxing").trim() || "Boxing";
  const gym = String(formData.get("gym") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim() || null;
  const dateStr = String(formData.get("date") ?? "");
  const rulesText = String(formData.get("rulesText") ?? "").trim() || null;
  const minAge = formData.get("minAge") ? Number(formData.get("minAge")) : null;
  const maxAge = formData.get("maxAge") ? Number(formData.get("maxAge")) : null;
  const sex = String(formData.get("sex") ?? "").trim() || null;
  const experienceLevel = String(formData.get("experienceLevel") ?? "").trim() || null;
  const weightGroupsRaw = String(formData.get("weightGroups") ?? "").trim();

  if (!gym || !dateStr) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "Gym and date are required." };
  }

  const weightGroupLabels = weightGroupsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const accessModeRaw = String(formData.get("accessMode") ?? "OPEN_TO_CLUBS");
  const accessMode: "INVITE" | "OPEN_TO_CLUBS" | "OPEN" =
    accessModeRaw === "INVITE" || accessModeRaw === "OPEN" ? accessModeRaw : "OPEN_TO_CLUBS";

  const session = await prisma.sparringSession.create({
    data: {
      clubId,
      sport,
      gym,
      city,
      date: new Date(dateStr),
      rulesText,
      minAge,
      maxAge,
      sex,
      experienceLevel,
      accessMode,
      weightGroups: {
        create: weightGroupLabels.map((label, i) => ({ label, order: i })),
      },
    },
  });

  revalidatePath("/sparring");
  revalidatePath("/sparring/host");
  redirect(`/sparring/${session.id}`);
}

export async function registerForSparring(sessionId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  const fighter = await getOwnFighter(actor.userId);
  if (!fighter) return { ok: false, code: "CONTEXT_REQUIRED", reason: "Register as a fighter first." };

  const session = await prisma.sparringSession.findUnique({ where: { id: sessionId }, include: { club: true } });
  if (!session) return { ok: false, code: "NOT_FOUND", reason: "Session not found." };
  if (session.status !== "OPEN") return { ok: false, code: "CONFLICT", reason: "This session is no longer open." };
  if (session.accessMode !== "OPEN") {
    return { ok: false, code: "FORBIDDEN", reason: "This session isn't open for direct requests — a club must nominate you." };
  }

  const existing = await prisma.sparringParticipant.findUnique({
    where: { sessionId_fighterId: { sessionId, fighterId: fighter.id } },
  });
  if (existing) return { ok: false, code: "CONFLICT", reason: "You're already registered for this session." };

  const weightGroupId = String(formData.get("weightGroupId") ?? "") || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  await prisma.sparringParticipant.create({
    data: { sessionId, fighterId: fighter.id, weightGroupId, note, status: "REQUESTED" },
  });

  await notifyMany(
    await clubAdminUserIds(session.clubId),
    "SPARRING_REQUESTED",
    `${fighter.displayName} wants to join sparring at ${session.gym}.`,
    `/sparring/${sessionId}`,
  );

  revalidatePath(`/sparring/${sessionId}`);
  return { ok: true };
}

export async function respondToParticipant(participantId: string, accept: boolean): Promise<ActionResult> {
  const actor = await getActor();

  const participant = await prisma.sparringParticipant.findUnique({
    where: { id: participantId },
    include: { session: true, fighter: { include: { user: true } } },
  });
  if (!participant) return { ok: false, code: "NOT_FOUND", reason: "Registration not found." };

  const gate = can(actor, "club.admin", { clubId: participant.session.clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  await prisma.sparringParticipant.update({
    where: { id: participantId },
    data: { status: accept ? "CONFIRMED" : "REJECTED" },
  });

  await notify(
    participant.fighter.userId,
    accept ? "SPARRING_ACCEPTED" : "SPARRING_DECLINED",
    accept
      ? `You're confirmed for sparring at ${participant.session.gym}.`
      : `Your request to spar at ${participant.session.gym} was declined.`,
    `/sparring/${participant.sessionId}`,
  );

  revalidatePath(`/sparring/${participant.sessionId}`);
  revalidatePath("/sparring/requests");
  return { ok: true };
}

export async function inviteFighter(sessionId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const session = await prisma.sparringSession.findUnique({ where: { id: sessionId } });
  if (!session) return { ok: false, code: "NOT_FOUND", reason: "Session not found." };

  const gate = can(actor, "club.admin", { clubId: session.clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const fighterId = String(formData.get("fighterId") ?? "");
  const fighter = await prisma.fighterProfile.findUnique({ where: { id: fighterId } });
  if (!fighter) return { ok: false, code: "NOT_FOUND", reason: "Fighter not found." };

  const existing = await prisma.sparringParticipant.findUnique({
    where: { sessionId_fighterId: { sessionId, fighterId } },
  });
  if (existing) return { ok: false, code: "CONFLICT", reason: "That fighter is already on this session." };

  await prisma.sparringParticipant.create({
    data: { sessionId, fighterId, status: "INVITED" },
  });

  await notify(fighter.userId, "SPARRING_INVITED", `You've been invited to spar at ${session.gym}.`, `/sparring/${sessionId}`);

  revalidatePath(`/sparring/${sessionId}`);
  return { ok: true };
}

export async function cancelParticipant(participantId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  const participant = await prisma.sparringParticipant.findUnique({
    where: { id: participantId },
    include: { session: true, fighter: true },
  });
  if (!participant) return { ok: false, code: "NOT_FOUND", reason: "Registration not found." };

  const isSelf = participant.fighter.userId === actor.userId;
  const isHost = can(actor, "club.admin", { clubId: participant.session.clubId }).allowed;
  if (!isSelf && !isHost) return { ok: false, code: "FORBIDDEN", reason: "You can't cancel this registration." };

  const existingMatch = await prisma.sparringMatch.findFirst({
    where: { OR: [{ participantAId: participantId }, { participantBId: participantId }] },
    include: { participantA: { include: { fighter: true } }, participantB: { include: { fighter: true } } },
  });

  await prisma.sparringParticipant.update({ where: { id: participantId }, data: { status: "CANCELLED" } });

  if (existingMatch) {
    const opponent = existingMatch.participantAId === participantId ? existingMatch.participantB : existingMatch.participantA;
    await notify(
      opponent.fighter.userId,
      "SPARRING_OPPONENT_CANCELLED",
      `${participant.fighter.displayName} cancelled — you'll need a new opponent at ${participant.session.gym}.`,
      `/sparring/${participant.sessionId}/match`,
    );
  }

  revalidatePath(`/sparring/${participant.sessionId}`);
  revalidatePath("/sparring/mine");
  return { ok: true };
}

export async function moveWeightGroup(participantId: string, weightGroupId: string | null): Promise<ActionResult> {
  const actor = await getActor();
  const participant = await prisma.sparringParticipant.findUnique({
    where: { id: participantId },
    include: { session: true },
  });
  if (!participant) return { ok: false, code: "NOT_FOUND", reason: "Registration not found." };

  const gate = can(actor, "club.admin", { clubId: participant.session.clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  await prisma.sparringParticipant.update({ where: { id: participantId }, data: { weightGroupId } });

  revalidatePath(`/sparring/${participant.sessionId}`);
  return { ok: true };
}

export async function createMatch(sessionId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const session = await prisma.sparringSession.findUnique({ where: { id: sessionId } });
  if (!session) return { ok: false, code: "NOT_FOUND", reason: "Session not found." };

  const gate = can(actor, "club.admin", { clubId: session.clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const participantAId = String(formData.get("participantAId") ?? "");
  const participantBId = String(formData.get("participantBId") ?? "");
  if (!participantAId || !participantBId || participantAId === participantBId) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "Two different fighters are required." };
  }

  const [a, b] = await Promise.all([
    prisma.sparringParticipant.findUnique({ where: { id: participantAId }, include: { fighter: true } }),
    prisma.sparringParticipant.findUnique({ where: { id: participantBId }, include: { fighter: true } }),
  ]);
  if (!a || !b) return { ok: false, code: "NOT_FOUND", reason: "Fighter not found." };

  await prisma.sparringMatch.create({
    data: { sessionId, participantAId, participantBId, status: "CONFIRMED" },
  });

  await Promise.all([
    notify(a.fighter.userId, "SPARRING_MATCHED", `You've been matched with ${b.fighter.displayName} at ${session.gym}.`, `/sparring/${sessionId}`),
    notify(b.fighter.userId, "SPARRING_MATCHED", `You've been matched with ${a.fighter.displayName} at ${session.gym}.`, `/sparring/${sessionId}`),
  ]);

  revalidatePath(`/sparring/${sessionId}`);
  return { ok: true };
}

export async function setSessionStatus(sessionId: string, status: "CLOSED" | "CANCELLED" | "COMPLETED" | "OPEN"): Promise<ActionResult> {
  const actor = await getActor();
  const session = await prisma.sparringSession.findUnique({ where: { id: sessionId } });
  if (!session) return { ok: false, code: "NOT_FOUND", reason: "Session not found." };

  const gate = can(actor, "club.admin", { clubId: session.clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  await prisma.sparringSession.update({ where: { id: sessionId }, data: { status } });

  revalidatePath(`/sparring/${sessionId}`);
  revalidatePath("/sparring/host");
  return { ok: true };
}
