"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { transitionEvent, IllegalTransitionError } from "@/lib/state/event";
import { slugify, generateEventCode } from "@/lib/slug";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/actions/types";
import { notifyMany } from "@/lib/actions/notify";
import { geocodeVenue } from "@/lib/geocode";

export async function createEvent(): Promise<{ ok: true; eventId: string } | { ok: false; code: string; reason: string }> {
  const actor = await getActor();
  const result = can(actor, "event.create");
  if (!result.allowed) return { ok: false, code: result.code, reason: result.reason };

  const event = await prisma.event.create({
    data: {
      name: "Untitled event",
      date: new Date(),
      createdByUserId: actor!.userId,
      status: "DRAFT",
      hostMembers: { create: [{ userId: actor!.userId }] },
      rings: { create: [{ number: 1 }] },
    },
  });

  revalidatePath("/host");
  return { ok: true, eventId: event.id };
}

/**
 * "Create tournament" from within a Club's context: sets organizingClubId
 * and host membership, then lands on /host/events/:id/build. No hat/role to
 * grant or switch — a club admin already has full organizer capability for
 * their own club's events.
 */
export async function createEventFromClub(clubId: string): Promise<ActionResult & { eventId?: string }> {
  const actor = await getActor();
  const gate = can(actor, "club.admin", { clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const event = await prisma.event.create({
    data: {
      name: "Untitled event",
      date: new Date(),
      createdByUserId: actor!.userId,
      organizingClubId: clubId,
      status: "DRAFT",
      hostMembers: { create: [{ userId: actor!.userId }] },
      rings: { create: [{ number: 1 }] },
    },
  });

  revalidatePath("/host");
  redirect(`/host/events/${event.id}/build`);
}

export async function updateEventSkeleton(eventId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false, code: "NOT_FOUND", reason: "Event not found." };

  const gate = can(actor, "event.edit", { eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const name = String(formData.get("name") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "");
  const city = String(formData.get("city") ?? "").trim() || null;
  const venue = String(formData.get("venue") ?? "").trim() || null;
  const streamUrl = String(formData.get("streamUrl") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!name || !dateStr) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "Name and date are required." };
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { name, date: new Date(dateStr), city, venue, streamUrl, description },
  });

  revalidatePath(`/host/events/${eventId}`);
  return { ok: true };
}

export async function updateEventStructure(eventId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "event.edit", { eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const sport = String(formData.get("sport") ?? "Boxing").trim() || "Boxing";
  const ringCount = Math.max(1, Number(formData.get("ringCount") ?? 1));
  const dayCount = Math.max(1, Number(formData.get("dayCount") ?? 1));

  const rings = await prisma.ring.findMany({ where: { eventId }, include: { _count: { select: { bouts: true } } } });

  if (ringCount > rings.length) {
    const highest = rings.reduce((max, r) => Math.max(max, r.number), 0);
    await prisma.ring.createMany({
      data: Array.from({ length: ringCount - rings.length }, (_, i) => ({
        eventId,
        number: highest + i + 1,
      })),
    });
  } else if (ringCount < rings.length) {
    const removable = rings.filter((r) => r.number > ringCount);
    const blocked = removable.some((r) => r._count.bouts > 0);
    if (blocked) {
      return { ok: false, code: "CONFLICT", reason: "Can't remove a ring that already has bouts assigned to it." };
    }
    await prisma.ring.deleteMany({ where: { id: { in: removable.map((r) => r.id) } } });
  }

  await prisma.event.update({ where: { id: eventId }, data: { sport, ringCount, dayCount } });
  revalidatePath(`/host/events/${eventId}`);
  revalidatePath(`/host/events/${eventId}/structure`);
  return { ok: true };
}

export async function renameRing(ringId: string, eventId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "event.edit", { eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const name = String(formData.get("name") ?? "").trim() || null;
  await prisma.ring.update({ where: { id: ringId }, data: { name } });

  revalidatePath(`/host/events/${eventId}/structure`);
  return { ok: true };
}

export async function addGuestFighter(formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  const eventId = String(formData.get("eventId") ?? "");
  const gate = can(actor, "event.edit", { eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const displayName = String(formData.get("name") ?? "").trim();
  const weightClass = String(formData.get("weightClass") ?? "").trim() || null;
  const clubName = String(formData.get("clubText") ?? "").trim();

  if (!displayName) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Boxer name is required." };

  // Guest fighters get a placeholder user + fighter profile ("Not in the app").
  const placeholderEmail = `guest.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@pugna.local`;
  const placeholderUser = await prisma.user.create({
    data: { email: placeholderEmail, passwordHash: "GUEST_NO_LOGIN", name: displayName },
  });

  let club = clubName ? await prisma.club.findFirst({ where: { name: clubName } }) : null;
  if (!club && clubName) {
    club = await prisma.club.create({ data: { name: clubName } });
  }

  const fighter = await prisma.fighterProfile.create({
    data: { userId: placeholderUser.id, displayName, weightClass, clubId: club?.id ?? null },
  });

  await prisma.nomination.create({
    data: {
      eventId,
      clubId: club?.id ?? (await ensureGuestClub()).id,
      fighterId: fighter.id,
      weightClass: weightClass ?? "Unassigned",
      status: "CONFIRMED",
    },
  });

  revalidatePath(`/host/events/${eventId}`);
  return { ok: true };
}

async function ensureGuestClub() {
  const existing = await prisma.club.findFirst({ where: { name: "Independent / Guest" } });
  if (existing) return existing;
  return prisma.club.create({ data: { name: "Independent / Guest" } });
}

export async function createBout(formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const eventId = String(formData.get("eventId") ?? "");
  const gate = can(actor, "event.edit", { eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const fighterAId = String(formData.get("fighterAId") ?? "") || null;
  const fighterBId = String(formData.get("fighterBId") ?? "") || null;
  const weightClass = String(formData.get("weightClass") ?? "").trim();
  const day = Math.max(1, Number(formData.get("day") ?? 1));
  let ringId = String(formData.get("ringId") ?? "") || null;

  if (!weightClass) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Weight class is required." };

  if (!ringId) {
    const firstRing = await prisma.ring.findFirst({ where: { eventId }, orderBy: { number: "asc" } });
    if (!firstRing) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Event has no rings configured." };
    ringId = firstRing.id;
  }

  const count = await prisma.bout.count({ where: { eventId } });
  const status = fighterAId && fighterBId ? "CONFIRMED" : "TBD";

  await prisma.bout.create({
    data: { eventId, number: count + 1, weightClass, ringId, day, fighterAId, fighterBId, status },
  });

  revalidatePath(`/host/events/${eventId}`);
  return { ok: true };
}

export async function setBoutSchedule(boutId: string, eventId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "event.edit", { eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const timeStr = String(formData.get("scheduledTime") ?? "");
  const bout = await prisma.bout.findUnique({ where: { id: boutId } });
  if (!bout) return { ok: false, code: "NOT_FOUND", reason: "Bout not found." };

  const nextStatus = bout.status === "TBD" ? "TBD" : bout.status === "DRAFT" ? "CONFIRMED" : bout.status;

  await prisma.bout.update({
    where: { id: boutId },
    data: { scheduledTime: timeStr ? new Date(timeStr) : null, status: nextStatus },
  });

  revalidatePath(`/host/events/${eventId}`);
  return { ok: true };
}

export async function markBoutReady(boutId: string, eventId: string): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "event.edit", { eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const bout = await prisma.bout.findUnique({ where: { id: boutId } });
  if (!bout) return { ok: false, code: "NOT_FOUND", reason: "Bout not found." };
  if (bout.status !== "CONFIRMED") return { ok: false, code: "CONFLICT", reason: "Bout must be confirmed first." };

  await prisma.bout.update({ where: { id: boutId }, data: { status: "READY" } });
  revalidatePath(`/host/events/${eventId}`);
  return { ok: true };
}

export async function publishEvent(eventId: string): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "event.publish", { eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { bouts: true } });
  if (!event) return { ok: false, code: "NOT_FOUND", reason: "Event not found." };

  if (!event.venue && !event.city) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "Add a venue or city before publishing." };
  }
  if (event.bouts.length === 0) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "Add at least one bout before publishing." };
  }
  const emptyBout = event.bouts.find((b) => !b.fighterAId && !b.fighterBId);
  if (emptyBout) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: `Bout ${emptyBout.number} has no boxers.` };
  }

  const slug = event.slug ?? slugify(event.name, event.date);

  const geo = event.latitude == null ? await geocodeVenue(event.venue, event.city) : null;

  try {
    if (event.status === "DRAFT") transitionEvent("DRAFT", "READY");
    const nextStatus = transitionEvent(event.status === "DRAFT" ? "READY" : event.status, "PUBLISHED");

    const code = event.code ?? generateEventCode();

    // Bring every non-terminal bout to READY so the projection has a valid NOW candidate.
    await prisma.$transaction([
      ...event.bouts
        .filter((b) => b.status === "CONFIRMED")
        .map((b) => prisma.bout.update({ where: { id: b.id }, data: { status: "READY" } })),
      prisma.event.update({
        where: { id: eventId },
        data: { status: nextStatus, slug, code, ...(geo ? { latitude: geo.lat, longitude: geo.lng } : {}) },
      }),
    ]);
  } catch (error) {
    if (error instanceof IllegalTransitionError) {
      return { ok: false, code: "CONFLICT", reason: error.message };
    }
    throw error;
  }

  const fighterUserIds = await getBoutFighterUserIds(eventId);
  await notifyMany(fighterUserIds, "EVENT_PUBLISHED", `${event.name} is published — check your schedule.`, `/e/${slug}`);

  revalidatePath(`/host/events/${eventId}`);
  revalidatePath("/events");
  redirect(`/host/events/${eventId}`);
}

export async function getBoutFighterUserIds(eventId: string): Promise<string[]> {
  const bouts = await prisma.bout.findMany({
    where: { eventId },
    include: { fighterA: true, fighterB: true },
  });
  const ids = bouts.flatMap((b) => [b.fighterA?.userId, b.fighterB?.userId]).filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

export async function getFollowerUserIds(eventId: string): Promise<string[]> {
  const follows = await prisma.follow.findMany({ where: { eventId }, select: { userId: true } });
  return follows.map((f) => f.userId);
}

export async function cancelEvent(eventId: string, formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "event.cancel", { eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const reason = String(formData.get("reason") ?? "").trim() || "Cancelled by organizer";
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false, code: "NOT_FOUND", reason: "Event not found." };

  try {
    transitionEvent(event.status, "CANCELLED");
  } catch (error) {
    if (error instanceof IllegalTransitionError) return { ok: false, code: "CONFLICT", reason: error.message };
    throw error;
  }

  await prisma.event.update({ where: { id: eventId }, data: { status: "CANCELLED", cancelReason: reason } });

  const [fighterUserIds, followerUserIds] = await Promise.all([
    getBoutFighterUserIds(eventId),
    getFollowerUserIds(eventId),
  ]);
  await notifyMany(
    [...fighterUserIds, ...followerUserIds],
    "EVENT_CANCELLED",
    `${event.name} was cancelled: ${reason}`,
    event.slug ? `/e/${event.slug}` : undefined,
  );

  revalidatePath(`/host/events/${eventId}`);
  revalidatePath("/events");
  return { ok: true };
}
