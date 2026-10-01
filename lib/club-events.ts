import { prisma } from "@/lib/prisma";
import type { EventStatus } from "@prisma/client";

export type ClubRelatedEvent = {
  id: string;
  slug: string | null;
  name: string;
  date: Date;
  venue: string | null;
  city: string | null;
  coverUrl: string | null;
  statusLabel: string;
  nominatedCount: number;
  isOrganizing: boolean;
};

const CLOSED: EventStatus[] = ["CANCELLED", "FINISHED", "ARCHIVED"];

/** Events this club is either confirmed-participating in (ClubEventParticipation)
 * or organizing (organizingClubId) — the "what are we in" list shared by Club
 * Home's "Upcoming Events" and Club Events' "My Events" tab. */
export async function getClubRelatedEvents(
  clubId: string,
  opts: { upcomingOnly?: boolean; take?: number } = {},
): Promise<ClubRelatedEvent[]> {
  const { upcomingOnly = false, take } = opts;
  const now = new Date();

  const [participations, organizing, nominations] = await Promise.all([
    prisma.clubEventParticipation.findMany({ where: { clubId }, include: { event: true } }),
    prisma.event.findMany({ where: { organizingClubId: clubId } }),
    prisma.nomination.findMany({ where: { clubId }, select: { eventId: true } }),
  ]);

  const nominationCountByEvent = new Map<string, number>();
  for (const n of nominations) {
    nominationCountByEvent.set(n.eventId, (nominationCountByEvent.get(n.eventId) ?? 0) + 1);
  }

  const isUpcoming = (date: Date, status: EventStatus) => date >= now && !CLOSED.includes(status);

  const byId = new Map<string, { event: (typeof organizing)[number]; isOrganizing: boolean }>();
  for (const p of participations) {
    if (upcomingOnly && !isUpcoming(p.event.date, p.event.status)) continue;
    byId.set(p.event.id, { event: p.event, isOrganizing: p.event.organizingClubId === clubId });
  }
  for (const event of organizing) {
    if (upcomingOnly && !isUpcoming(event.date, event.status)) continue;
    byId.set(event.id, { event, isOrganizing: true });
  }

  const eventIds = [...byId.keys()];
  const covers =
    eventIds.length > 0
      ? await prisma.media.findMany({
          where: { attachedType: "EVENT", attachedId: { in: eventIds }, kind: "EVENT_COVER" },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const coverFor = (id: string) => covers.find((m) => m.attachedId === id)?.url ?? null;

  const items: ClubRelatedEvent[] = [...byId.values()].map(({ event, isOrganizing }) => ({
    id: event.id,
    slug: event.slug,
    name: event.name,
    date: event.date,
    venue: event.venue,
    city: event.city,
    coverUrl: coverFor(event.id),
    statusLabel: isOrganizing ? "Organizing" : "Participating",
    nominatedCount: nominationCountByEvent.get(event.id) ?? 0,
    isOrganizing,
  }));

  items.sort((a, b) => a.date.getTime() - b.date.getTime());
  return take ? items.slice(0, take) : items;
}
