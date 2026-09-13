"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { applyBoutAction } from "@/lib/state/bout";
import { transitionEvent, IllegalTransitionError } from "@/lib/state/event";
import { assertStartAllowed, ProjectionConflictError } from "@/lib/projection";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import type { ScratchReason } from "@prisma/client";
import { notifyMany } from "@/lib/actions/notify";
import { getFollowerUserIds } from "@/lib/actions/event";

function boutFighterUserIds(bout: { fighterA: { userId: string } | null; fighterB: { userId: string } | null }): string[] {
  return [bout.fighterA?.userId, bout.fighterB?.userId].filter((id): id is string => Boolean(id));
}

/** Parses an "HH:MM" `<input type="time">` value into today's Date — rolls to
 * tomorrow if that time has already passed today (e.g. scheduling a break
 * just after midnight). Returns null for a blank/missing value. */
function timeStringToDate(timeStr: string | null, now: Date = new Date()): Date | null {
  if (!timeStr) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
  if (!match) return null;
  const [, hStr, mStr] = match;
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(hStr), Number(mStr), 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

async function gateLive(eventId: string): Promise<ActionResult | null> {
  const actor = await getActor();
  const gate = can(actor, "live.act", { eventId });
  return gate.allowed ? null : { ok: false, code: gate.code, reason: gate.reason };
}

export async function startBout(boutId: string, eventId: string): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  const bout = await prisma.bout.findUnique({
    where: { id: boutId },
    include: { fighterA: true, fighterB: true, ring: true },
  });
  if (!event || !bout) return { ok: false, code: "NOT_FOUND", reason: "Not found." };

  try {
    assertStartAllowed(event.status, bout.ring.onBreak);
    const nextStatus = applyBoutAction(bout.status, "START");

    const nextEventStatus = event.status === "PUBLISHED" ? transitionEvent("PUBLISHED", "LIVE") : event.status;

    // A bout with a round clock configured starts Round 1 in the same tap —
    // no redundant second "Start round" press for the common case.
    const roundData =
      bout.totalRounds && bout.totalRounds > 0
        ? { currentRound: 1, roundPhase: "ROUND" as const, phaseEndsAt: new Date(Date.now() + bout.roundDurationSec * 1000) }
        : {};

    await prisma.$transaction([
      prisma.bout.update({ where: { id: boutId }, data: { status: nextStatus, ...roundData } }),
      prisma.event.update({ where: { id: eventId }, data: { status: nextEventStatus } }),
    ]);
  } catch (error) {
    if (error instanceof ProjectionConflictError || error instanceof IllegalTransitionError) {
      return { ok: false, code: "CONFLICT", reason: error.message };
    }
    throw error;
  }

  const fighterUserIds = boutFighterUserIds(bout);
  await notifyMany(fighterUserIds, "BOUT_LIVE", `Your bout at ${event.name} is starting now.`, `/e/${event.slug ?? ""}`);

  // Separately notify followers who tapped "Notify me" on this specific fight —
  // distinct wording (who's fighting, not "your bout") and links straight to it.
  const followerIds = (await getFollowerUserIds(eventId)).filter((id) => !fighterUserIds.includes(id));
  const fighterAName = bout.fighterA?.displayName ?? "TBD";
  const fighterBName = bout.fighterB?.displayName ?? "TBD";
  await notifyMany(
    followerIds,
    "BOUT_LIVE",
    `${fighterAName} vs ${fighterBName} is live now at ${event.name}.`,
    `/e/${event.slug ?? ""}/bout/${boutId}`,
  );

  // Separately, anyone who asked to be notified next time THIS fighter fights
  // (not the same as following the event) — a standing subscription, so it
  // fires for every one of the fighter's bouts in this event, not just one.
  const boutFighterIds = [bout.fighterAId, bout.fighterBId].filter((id): id is string => Boolean(id));
  if (boutFighterIds.length > 0) {
    const alerts = await prisma.fighterNextBoutAlert.findMany({
      where: { eventId, fighterId: { in: boutFighterIds } },
      include: { fighter: true },
    });
    for (const fighterId of boutFighterIds) {
      const subscriberIds = alerts.filter((a) => a.fighterId === fighterId).map((a) => a.userId);
      if (subscriberIds.length === 0) continue;
      const fighterName = alerts.find((a) => a.fighterId === fighterId)?.fighter.displayName ?? "The fighter you follow";
      await notifyMany(
        subscriberIds,
        "FIGHTER_NEXT_BOUT_LIVE",
        `${fighterName} is fighting now.`,
        `/e/${event.slug ?? ""}/bout/${boutId}`,
      );
    }
  }

  revalidateLive(eventId);
  return { ok: true };
}

/** Ends the round in progress and starts the rest period — purely a display
 * transition (round/rest is advisory, never auto-advances on its own; the
 * host taps this, same as every other Live Console action). */
export async function startRest(boutId: string, eventId: string): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const bout = await prisma.bout.findUnique({ where: { id: boutId } });
  if (!bout) return { ok: false, code: "NOT_FOUND", reason: "Not found." };
  if (bout.roundPhase !== "ROUND") return { ok: false, code: "CONFLICT", reason: "No round in progress." };

  await prisma.bout.update({
    where: { id: boutId },
    data: { roundPhase: "REST", phaseEndsAt: new Date(Date.now() + bout.restDurationSec * 1000) },
  });

  revalidateLive(eventId);
  return { ok: true };
}

/** Starts the next round after a rest period. */
export async function startRound(boutId: string, eventId: string): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const bout = await prisma.bout.findUnique({ where: { id: boutId } });
  if (!bout) return { ok: false, code: "NOT_FOUND", reason: "Not found." };
  if (!bout.totalRounds || bout.currentRound >= bout.totalRounds) {
    return { ok: false, code: "CONFLICT", reason: "No rounds left." };
  }

  await prisma.bout.update({
    where: { id: boutId },
    data: {
      currentRound: bout.currentRound + 1,
      roundPhase: "ROUND",
      phaseEndsAt: new Date(Date.now() + bout.roundDurationSec * 1000),
    },
  });

  revalidateLive(eventId);
  return { ok: true };
}

export async function finishBout(boutId: string, eventId: string, formData: FormData): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const bout = await prisma.bout.findUnique({ where: { id: boutId }, include: { fighterA: true, fighterB: true, event: true } });
  if (!bout) return { ok: false, code: "NOT_FOUND", reason: "Not found." };

  const winnerId = String(formData.get("winnerId") ?? "") || null;
  const method = String(formData.get("method") ?? "").trim();
  const roundStr = String(formData.get("round") ?? "");
  const round = roundStr ? Number(roundStr) : null;

  if (!method) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Method is required." };

  try {
    const nextStatus = applyBoutAction(bout.status, "FINISH");
    const loserId = winnerId
      ? winnerId === bout.fighterAId
        ? bout.fighterBId
        : bout.fighterAId
      : null;

    await prisma.$transaction([
      prisma.bout.update({ where: { id: boutId }, data: { status: nextStatus } }),
      prisma.result.create({ data: { boutId, winnerId, loserId, method, round } }),
    ]);
  } catch (error) {
    if (error instanceof IllegalTransitionError) return { ok: false, code: "CONFLICT", reason: error.message };
    throw error;
  }

  await notifyMany(boutFighterUserIds(bout), "BOUT_RESULT", `Result posted for your bout at ${bout.event.name}: ${method}.`, `/e/${bout.event.slug ?? ""}`);

  revalidateLive(eventId);
  return { ok: true };
}

export async function delayBout(boutId: string, eventId: string, formData: FormData): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const bout = await prisma.bout.findUnique({ where: { id: boutId }, include: { fighterA: true, fighterB: true, event: true } });
  if (!bout) return { ok: false, code: "NOT_FOUND", reason: "Not found." };

  const minutes = Number(formData.get("minutes") ?? 5);

  try {
    const nextStatus = applyBoutAction(bout.status, "DELAY");
    const addedMinutes = (bout.delayMinutes ?? 0) + minutes;
    await prisma.bout.update({ where: { id: boutId }, data: { status: nextStatus, delayMinutes: addedMinutes } });
  } catch (error) {
    if (error instanceof IllegalTransitionError) return { ok: false, code: "CONFLICT", reason: error.message };
    throw error;
  }

  const followerIds = await getFollowerUserIds(eventId);
  await notifyMany(
    [...boutFighterUserIds(bout), ...followerIds],
    "BOUT_DELAYED",
    `Bout ${bout.number} at ${bout.event.name} is delayed.`,
    `/e/${bout.event.slug ?? ""}`,
  );

  revalidateLive(eventId);
  return { ok: true };
}

export async function scratchBout(boutId: string, eventId: string, formData: FormData): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const bout = await prisma.bout.findUnique({ where: { id: boutId }, include: { fighterA: true, fighterB: true, event: true } });
  if (!bout) return { ok: false, code: "NOT_FOUND", reason: "Not found." };

  const reason = String(formData.get("reason") ?? "OTHER") as ScratchReason;

  try {
    const nextStatus = applyBoutAction(bout.status, "SCRATCH");
    await prisma.bout.update({ where: { id: boutId }, data: { status: nextStatus, scratchReason: reason } });
  } catch (error) {
    if (error instanceof IllegalTransitionError) return { ok: false, code: "CONFLICT", reason: error.message };
    throw error;
  }

  await notifyMany(boutFighterUserIds(bout), "BOUT_SCRATCHED", `Your bout at ${bout.event.name} was scratched.`, `/e/${bout.event.slug ?? ""}`);

  revalidateLive(eventId);
  return { ok: true };
}

export async function noShowBout(boutId: string, eventId: string): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const bout = await prisma.bout.findUnique({ where: { id: boutId } });
  if (!bout) return { ok: false, code: "NOT_FOUND", reason: "Not found." };

  try {
    const nextStatus = applyBoutAction(bout.status, "NO_SHOW");
    await prisma.bout.update({ where: { id: boutId }, data: { status: nextStatus } });
  } catch (error) {
    if (error instanceof IllegalTransitionError) return { ok: false, code: "CONFLICT", reason: error.message };
    throw error;
  }

  revalidateLive(eventId);
  return { ok: true };
}

export async function startIntermission(eventId: string, formData?: FormData): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false, code: "NOT_FOUND", reason: "Not found." };

  const resumeAt = timeStringToDate(formData ? String(formData.get("resumeAt") ?? "") || null : null);

  try {
    const nextStatus = transitionEvent(event.status, "INTERMISSION");
    await prisma.event.update({ where: { id: eventId }, data: { status: nextStatus, intermissionUntil: resumeAt } });
  } catch (error) {
    if (error instanceof IllegalTransitionError) return { ok: false, code: "CONFLICT", reason: error.message };
    throw error;
  }

  revalidateLive(eventId);
  return { ok: true };
}

export async function endIntermission(eventId: string): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false, code: "NOT_FOUND", reason: "Not found." };

  try {
    const nextStatus = transitionEvent(event.status, "LIVE");
    await prisma.event.update({ where: { id: eventId }, data: { status: nextStatus, intermissionUntil: null } });
  } catch (error) {
    if (error instanceof IllegalTransitionError) return { ok: false, code: "CONFLICT", reason: error.message };
    throw error;
  }

  revalidateLive(eventId);
  return { ok: true };
}

/** A break's resume time can come as an absolute "HH:MM" (`resumeAt`, the
 * original input) or as minutes-from-now (`minutes`, the new duration
 * stepper) — minutes wins when both are present since it's what the
 * redesigned break sheet actually submits. */
function resolveBreakUntil(formData?: FormData): Date | null {
  if (!formData) return null;
  const minutesStr = String(formData.get("minutes") ?? "");
  if (minutesStr) {
    const minutes = Number(minutesStr);
    return Number.isFinite(minutes) && minutes > 0 ? new Date(Date.now() + minutes * 60 * 1000) : null;
  }
  return timeStringToDate(String(formData.get("resumeAt") ?? "") || null);
}

export async function setRingBreak(ringId: string, eventId: string, onBreak: boolean, formData?: FormData): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const ring = await prisma.ring.findUnique({ where: { id: ringId } });
  if (!ring || ring.eventId !== eventId) return { ok: false, code: "NOT_FOUND", reason: "Ring not found." };

  const breakUntil = onBreak ? resolveBreakUntil(formData) : null;
  const breakReason = onBreak ? String(formData?.get("reason") ?? "").trim() || null : null;

  await prisma.ring.update({ where: { id: ringId }, data: { onBreak, breakUntil, breakReason } });

  revalidateLive(eventId);
  return { ok: true };
}

/** Same as `setRingBreak` but for several rings at once (the redesigned break
 * sheet's "Affected Rings" checkboxes) — one atomic transaction instead of N
 * separate taps/round trips. */
export async function setRingsBreak(eventId: string, ringIds: string[], onBreak: boolean, formData?: FormData): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;
  if (ringIds.length === 0) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Select at least one ring." };

  const rings = await prisma.ring.findMany({ where: { id: { in: ringIds }, eventId } });
  if (rings.length !== ringIds.length) return { ok: false, code: "NOT_FOUND", reason: "Ring not found." };

  const breakUntil = onBreak ? resolveBreakUntil(formData) : null;
  const breakReason = onBreak ? String(formData?.get("reason") ?? "").trim() || null : null;

  await prisma.$transaction(
    ringIds.map((ringId) => prisma.ring.update({ where: { id: ringId }, data: { onBreak, breakUntil, breakReason } })),
  );

  revalidateLive(eventId);
  return { ok: true };
}

export async function postAnnouncement(eventId: string, formData: FormData): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Announcement text is required." };

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false, code: "NOT_FOUND", reason: "Not found." };

  const followerIds = await getFollowerUserIds(eventId);
  await notifyMany(followerIds, "EVENT_ANNOUNCEMENT", `${event.name}: ${message}`, event.slug ? `/e/${event.slug}` : undefined);

  revalidateLive(eventId);
  return { ok: true };
}

export async function finishEvent(eventId: string): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { bouts: true } });
  if (!event) return { ok: false, code: "NOT_FOUND", reason: "Not found." };

  const allTerminal = event.bouts.every((b) => ["FINAL", "SCRATCHED", "NO_SHOW"].includes(b.status));
  if (!allTerminal) return { ok: false, code: "CONFLICT", reason: "All bouts must be final, scratched, or no-show first." };

  try {
    const nextStatus = transitionEvent(event.status, "FINISHED");
    await prisma.event.update({ where: { id: eventId }, data: { status: nextStatus } });
  } catch (error) {
    if (error instanceof IllegalTransitionError) return { ok: false, code: "CONFLICT", reason: error.message };
    throw error;
  }

  const followerIds = await getFollowerUserIds(eventId);
  await notifyMany(followerIds, "EVENT_FINISHED", `${event.name} has finished.`, event.slug ? `/e/${event.slug}` : undefined);

  revalidateLive(eventId);
  revalidatePath("/events");
  return { ok: true };
}

function revalidateLive(eventId: string) {
  revalidatePath(`/host/events/${eventId}/live`);
  revalidatePath(`/host/events/${eventId}`);
}
