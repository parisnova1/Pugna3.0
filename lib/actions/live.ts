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

async function gateLive(eventId: string): Promise<ActionResult | null> {
  const actor = await getActor();
  const gate = can(actor, "live.act", { eventId });
  return gate.allowed ? null : { ok: false, code: gate.code, reason: gate.reason };
}

export async function startBout(boutId: string, eventId: string): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  const bout = await prisma.bout.findUnique({ where: { id: boutId }, include: { fighterA: true, fighterB: true } });
  if (!event || !bout) return { ok: false, code: "NOT_FOUND", reason: "Not found." };

  try {
    assertStartAllowed(event.status);
    const nextStatus = applyBoutAction(bout.status, "START");

    const nextEventStatus = event.status === "PUBLISHED" ? transitionEvent("PUBLISHED", "LIVE") : event.status;

    await prisma.$transaction([
      prisma.bout.update({ where: { id: boutId }, data: { status: nextStatus } }),
      prisma.event.update({ where: { id: eventId }, data: { status: nextEventStatus } }),
    ]);
  } catch (error) {
    if (error instanceof ProjectionConflictError || error instanceof IllegalTransitionError) {
      return { ok: false, code: "CONFLICT", reason: error.message };
    }
    throw error;
  }

  await notifyMany(boutFighterUserIds(bout), "BOUT_LIVE", `Your bout at ${event.name} is starting now.`, `/e/${event.slug ?? ""}`);

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

export async function startIntermission(eventId: string): Promise<ActionResult> {
  const denied = await gateLive(eventId);
  if (denied) return denied;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false, code: "NOT_FOUND", reason: "Not found." };

  try {
    const nextStatus = transitionEvent(event.status, "INTERMISSION");
    await prisma.event.update({ where: { id: eventId }, data: { status: nextStatus } });
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
    await prisma.event.update({ where: { id: eventId }, data: { status: nextStatus } });
  } catch (error) {
    if (error instanceof IllegalTransitionError) return { ok: false, code: "CONFLICT", reason: error.message };
    throw error;
  }

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
