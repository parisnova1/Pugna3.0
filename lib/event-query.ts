import { prisma } from "@/lib/prisma";
import { computeProjection, computeRingProjections } from "@/lib/projection";

export async function getEventCardData(slug: string, ringId?: string) {
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      bouts: {
        include: {
          fighterA: true,
          fighterB: true,
          result: true,
        },
        orderBy: { number: "asc" },
      },
      rings: { orderBy: { number: "asc" } },
      organizingClub: true,
      createdBy: { include: { organizerProfile: true } },
      _count: { select: { follows: true } },
    },
  });

  if (!event) return null;

  if (!ringId) {
    // Whole-event projection — unchanged path, used by the simple single-ring/single-day card.
    return { event, bouts: event.bouts, ring: null, projection: computeProjection(event.status, event.bouts) };
  }

  const ring = event.rings.find((r) => r.id === ringId) ?? null;
  if (!ring) return { event, bouts: [], ring: null, projection: { now: null, next: null, nowLabel: null } };

  const scopedBouts = event.bouts.filter((b) => b.ringId === ring.id);
  const projection = computeRingProjections(event.status, [ring], scopedBouts).get(ring.id)!;

  return { event, bouts: scopedBouts, ring, projection };
}

export type EventCardData = NonNullable<Awaited<ReturnType<typeof getEventCardData>>>;
