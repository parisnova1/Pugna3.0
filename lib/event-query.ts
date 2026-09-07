import { prisma } from "@/lib/prisma";
import { computeProjection } from "@/lib/projection";

export async function getEventCardData(slug: string) {
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
      _count: { select: { follows: true } },
    },
  });

  if (!event) return null;

  const projection = computeProjection(event.status, event.bouts);

  return { event, projection };
}

export type EventCardData = NonNullable<Awaited<ReturnType<typeof getEventCardData>>>;
