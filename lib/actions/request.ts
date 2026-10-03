"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { notify, notifyMany } from "@/lib/actions/notify";
import { isEntryOpen } from "@/lib/event-status";

// requestClub() + the legacy EventRequest-based "requirements" flow was
// retired in favor of lib/actions/clubEvent.ts's inviteClubToEvent/
// ClubEventInvite -- the canonical club<->event registration system (see
// PUGNA_PHASE0_AUDIT.md section 13). The EventRequest/RequestStatus schema
// is left in place, unused, rather than a destructive migration.

export async function nominateFighter(formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const clubId = String(formData.get("clubId") ?? "");
  const gate = can(actor, "club.nominate", { clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const eventId = String(formData.get("eventId") ?? "");
  const fighterId = String(formData.get("fighterId") ?? "");
  const weightClass = String(formData.get("weightClass") ?? "").trim();

  if (!eventId || !fighterId || !weightClass) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "Boxer, event, and weight class are required." };
  }

  if (weightClass.length > 20) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Weight class is too long." };

  // Authorizing the club is not enough: the event, fighter and club must relate.
  const [event, fighter, participating, alreadyNominated] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId } }),
    prisma.fighterProfile.findUnique({ where: { id: fighterId } }),
    prisma.clubEventParticipation.findFirst({ where: { eventId, clubId }, select: { id: true } }),
    prisma.nomination.findFirst({
      where: { eventId, fighterId, status: { notIn: ["DECLINED", "WITHDRAWN", "REPLACEMENT"] } },
      select: { id: true },
    }),
  ]);
  if (!event || !isEntryOpen(event.status)) return { ok: false, code: "NOT_FOUND", reason: "That event isn't taking entries." };
  if (!participating) return { ok: false, code: "FORBIDDEN", reason: "Your club isn't participating in this event." };
  if (!fighter || fighter.clubId !== clubId) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "Choose a boxer from your own roster." };
  }
  if (alreadyNominated) return { ok: false, code: "CONFLICT", reason: "That boxer is already nominated for this event." };

  const nomination = await prisma.nomination.create({
    data: { eventId, clubId, fighterId, weightClass, status: "PENDING" },
    include: { fighter: true },
  });

  await notify(
    nomination.fighter.userId,
    "NOMINATED",
    `You've been nominated for ${event.name} at ${weightClass}.`,
    "/you/noms",
  );

  revalidatePath(`/host/events/${eventId}/entries`);
  revalidatePath("/club/requests");
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
      "/club/requests",
    );
  } else {
    // Replacement banner: flip to REPLACEMENT so the club sees it needs a new fighter.
    await prisma.nomination.update({ where: { id: nominationId }, data: { status: "REPLACEMENT" } });
    await notifyMany(
      clubAdminIds,
      "NOMINATION_DECLINED",
      `${nomination.fighter.displayName} declined the nomination for ${nomination.event.name} — a replacement is needed.`,
      "/club/requests",
    );
  }

  revalidatePath("/you/noms");
  revalidatePath("/club/requests");
  return { ok: true };
}
