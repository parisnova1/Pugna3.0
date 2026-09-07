"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/hat";
import type { Prisma } from "@prisma/client";
import { notify, notifyMany } from "@/lib/actions/notify";

export type Requirement = { weightClass: string; need: number };

export async function requestClub(formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const eventId = String(formData.get("eventId") ?? "");
  const gate = can(actor, "event.edit", { eventId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const clubId = String(formData.get("clubId") ?? "");
  const weightClass = String(formData.get("weightClass") ?? "").trim();
  const need = Math.max(1, Number(formData.get("need") ?? 1));

  if (!clubId || !weightClass) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Club and weight class are required." };

  const existing = await prisma.eventRequest.findUnique({ where: { eventId_clubId: { eventId, clubId } } });

  if (existing) {
    const requirements = (existing.requirements as Requirement[]) ?? [];
    requirements.push({ weightClass, need });
    await prisma.eventRequest.update({ where: { id: existing.id }, data: { requirements: requirements as unknown as Prisma.InputJsonValue, status: "PENDING" } });
  } else {
    await prisma.eventRequest.create({
      data: { eventId, clubId, requirements: [{ weightClass, need }] as unknown as Prisma.InputJsonValue, status: "PENDING" },
    });
  }

  revalidatePath(`/host/events/${eventId}/entries`);
  return { ok: true };
}

export async function nominateFighter(formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const clubId = String(formData.get("clubId") ?? "");
  const gate = can(actor, "club.nominate", { clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const eventId = String(formData.get("eventId") ?? "");
  const fighterId = String(formData.get("fighterId") ?? "");
  const weightClass = String(formData.get("weightClass") ?? "").trim();

  if (!eventId || !fighterId || !weightClass) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "Fighter, event, and weight class are required." };
  }

  const [nomination, event] = await Promise.all([
    prisma.nomination.create({ data: { eventId, clubId, fighterId, weightClass, status: "PENDING" }, include: { fighter: true } }),
    prisma.event.findUnique({ where: { id: eventId } }),
  ]);

  await notify(
    nomination.fighter.userId,
    "NOMINATED",
    `You've been nominated for ${event?.name ?? "an event"} at ${weightClass}.`,
    "/you/noms",
  );

  revalidatePath(`/host/events/${eventId}/entries`);
  revalidatePath("/club/events");
  revalidatePath("/you/noms");
  return { ok: true };
}

export async function respondToNomination(nominationId: string, accept: boolean): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "nomination.respond");
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const nomination = await prisma.nomination.findUnique({
    where: { id: nominationId },
    include: { fighter: true, event: true, club: { include: { admins: true } } },
  });
  if (!nomination) return { ok: false, code: "NOT_FOUND", reason: "Nomination not found." };
  if (nomination.fighter.userId !== actor!.userId) {
    return { ok: false, code: "FORBIDDEN", reason: "This nomination isn't yours." };
  }

  const clubAdminIds = nomination.club.admins.map((a) => a.userId);

  if (accept) {
    await prisma.nomination.update({ where: { id: nominationId }, data: { status: "ACCEPTED" } });
    await notifyMany(
      clubAdminIds,
      "NOMINATION_ACCEPTED",
      `${nomination.fighter.displayName} accepted the nomination for ${nomination.event.name}.`,
      "/club/events",
    );
  } else {
    // Replacement banner: flip to REPLACEMENT so the club sees it needs a new fighter.
    await prisma.nomination.update({ where: { id: nominationId }, data: { status: "REPLACEMENT" } });
    await notifyMany(
      clubAdminIds,
      "NOMINATION_DECLINED",
      `${nomination.fighter.displayName} declined the nomination for ${nomination.event.name} — a replacement is needed.`,
      "/club/events",
    );
  }

  revalidatePath("/you/noms");
  revalidatePath("/club/events");
  return { ok: true };
}
