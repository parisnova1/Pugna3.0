"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { logScan } from "@/lib/actions/scanHistory";
import type { CheckInSource } from "@prisma/client";

export type CheckInAttempt =
  | { status: "OK"; eventName: string; eventSlug: string | null; alreadyCheckedIn: boolean; liveBoutId: string | null }
  | { status: "INVALID_CODE" }
  | { status: "NOT_PUBLISHED"; eventName: string; eventSlug: string | null }
  | { status: "NOT_LIVE_YET"; eventName: string; eventSlug: string | null }
  | { status: "CLOSED"; eventName: string; eventSlug: string | null }
  | { status: "AUTH_REQUIRED" };

/**
 * Resolves an event (by id or by its public /go/:code) and attempts to check
 * the current viewer in — venue-audience check-in, unlocking the crowd
 * composer, distinct from the fighter-roster `CheckIn` model. Only ever
 * called from an explicit tap (QR scan landing on /in/:code, or the "Check in
 * now"/"Enter code" actions on /e/:slug/check-in) — never from a page's own
 * render path, so opening /e/:slug never silently checks anyone in.
 */
export async function checkInViewer({
  eventId,
  code,
  source,
}: {
  eventId?: string;
  code?: string;
  source: CheckInSource;
}): Promise<CheckInAttempt> {
  const actor = await getActor();
  if (!actor) return { status: "AUTH_REQUIRED" };

  const event = eventId
    ? await prisma.event.findUnique({ where: { id: eventId } })
    : code
      ? await prisma.event.findUnique({ where: { code } })
      : null;

  if (!event) return { status: "INVALID_CODE" };

  const info = { eventName: event.name, eventSlug: event.slug };

  if (event.status === "DRAFT" || event.status === "READY") return { status: "NOT_PUBLISHED", ...info };
  if (event.status === "PUBLISHED") return { status: "NOT_LIVE_YET", ...info };
  if (event.status === "FINISHED" || event.status === "CANCELLED" || event.status === "ARCHIVED") {
    return { status: "CLOSED", ...info };
  }

  // LIVE or INTERMISSION — the only states check-in actually creates a row in.
  const existing = await prisma.eventCheckIn.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: actor.userId } },
  });

  if (!existing) {
    await prisma.eventCheckIn.create({ data: { eventId: event.id, userId: actor.userId, source } });
    await logScan({
      userId: actor.userId,
      kind: "EVENT",
      label: event.name,
      detail: "Check in successful",
      href: event.slug ? `/e/${event.slug}` : `/checkin/event/${event.id}`,
    });
  }

  const liveBout = await prisma.bout.findFirst({ where: { eventId: event.id, status: "IN_PROGRESS" }, select: { id: true } });

  return { status: "OK", ...info, alreadyCheckedIn: Boolean(existing), liveBoutId: liveBout?.id ?? null };
}
