"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can, type Actor, type CanResult } from "@/lib/rbac";
import type { ActionResult } from "@/lib/actions/types";
import type { CrowdEmoji } from "@prisma/client";
import { containsBlockedWord } from "@/lib/crowd-moderation";

const SHOUT_MAX_LENGTH = 60;
const SHOUT_MIN_INTERVAL_MS = 20_000;
const SHOUT_MAX_PER_BOUT = 10;

/** Single source of truth for "can this user write to this bout's crowd right
 * now" — loads the bout + the caller's check-in/mute rows, then defers to the
 * pure `can()` gate. Used by both actions below. */
async function gateCrowdWrite(
  actor: Actor,
  boutId: string,
): Promise<{ gate: CanResult; bout: { id: string; eventId: string; status: string } | null }> {
  const bout = await prisma.bout.findUnique({ where: { id: boutId }, select: { id: true, eventId: true, status: true } });
  if (!bout) return { gate: { allowed: false, code: "NOT_FOUND", reason: "Bout not found." }, bout: null };

  if (!actor) return { gate: can(actor, "crowd.write", {}), bout };

  const [checkIn, mute] = await Promise.all([
    prisma.eventCheckIn.findUnique({ where: { eventId_userId: { eventId: bout.eventId, userId: actor.userId } } }),
    prisma.crowdMute.findUnique({ where: { eventId_userId: { eventId: bout.eventId, userId: actor.userId } } }),
  ]);

  const gate = can(actor, "crowd.write", {
    checkedIn: Boolean(checkIn),
    boutInProgress: bout.status === "IN_PROGRESS",
    muted: Boolean(mute),
  });

  return { gate, bout };
}

export async function toggleReaction(boutId: string, emoji: CrowdEmoji): Promise<ActionResult> {
  const actor = await getActor();
  const { gate } = await gateCrowdWrite(actor, boutId);
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const existing = await prisma.crowdReaction.findUnique({
    where: { boutId_userId_emoji: { boutId, userId: actor!.userId, emoji } },
  });

  if (existing) {
    await prisma.crowdReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.crowdReaction.create({ data: { boutId, userId: actor!.userId, emoji } });
  }

  return { ok: true };
}

export async function postShout(boutId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const { gate } = await gateCrowdWrite(actor, boutId);
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Say something first." };
  if (text.length > SHOUT_MAX_LENGTH) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Keep it under 60 characters." };

  const [lastShout, shoutCount] = await Promise.all([
    prisma.crowdShout.findFirst({ where: { boutId, userId: actor!.userId }, orderBy: { createdAt: "desc" } }),
    prisma.crowdShout.count({ where: { boutId, userId: actor!.userId } }),
  ]);

  if (lastShout && Date.now() - lastShout.createdAt.getTime() < SHOUT_MIN_INTERVAL_MS) {
    return { ok: false, code: "CONFLICT", reason: "Slow down — try again in a few seconds." };
  }
  if (shoutCount >= SHOUT_MAX_PER_BOUT) {
    return { ok: false, code: "CONFLICT", reason: "You've reached the limit for this fight." };
  }

  await prisma.crowdShout.create({
    data: { boutId, userId: actor!.userId, text, hidden: containsBlockedWord(text) },
  });

  return { ok: true };
}

export async function hideShout(shoutId: string, eventId: string): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "event.edit", { eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  await prisma.crowdShout.update({ where: { id: shoutId }, data: { hidden: true } });
  return { ok: true };
}

export async function muteUser(eventId: string, userId: string): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "event.edit", { eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  await prisma.crowdMute.upsert({
    where: { eventId_userId: { eventId, userId } },
    update: {},
    create: { eventId, userId },
  });
  return { ok: true };
}
