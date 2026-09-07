import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { EventPreviewCard } from "@/components/event/EventPreviewCard";
import { SeeAllLink } from "@/components/event/SeeAllLink";

export default async function DiscoverPage() {
  const actor = await getActor();

  const [live, upcoming, clubs, following] = await Promise.all([
    prisma.event.findMany({
      where: { status: { in: ["LIVE", "INTERMISSION"] } },
      orderBy: { date: "asc" },
      take: 5,
    }),
    prisma.event.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { date: "asc" },
      take: 6,
    }),
    prisma.club.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { _count: { select: { roster: true } } },
    }),
    actor
      ? prisma.event.findMany({
          where: {
            follows: { some: { userId: actor.userId } },
            status: { in: ["PUBLISHED", "LIVE", "INTERMISSION"] },
          },
          orderBy: { date: "asc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-3 pt-2">
        <h1 className="text-3xl font-semibold leading-tight">
          Know when the
          <br />
          bout starts.
        </h1>
        <p className="text-mute text-sm">The live fight card for combat sports.</p>
        <div className="flex gap-2 pt-1">
          <Link href="/events" className="rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm">
            Explore events
          </Link>
          <Link href="/scan" className="rounded-pill border border-white/20 text-ink font-semibold px-5 py-3 text-sm">
            Scan QR
          </Link>
        </div>
      </section>

      {following.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Following</h2>
          <div className="space-y-3">
            {following.map((event) => (
              <EventPreviewCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {live.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Live now</h2>
          <div className="space-y-3">
            {live.map((event) => (
              <EventPreviewCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Upcoming</h2>
          <SeeAllLink href="/events" />
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-mute">No events nearby yet.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((event) => (
              <EventPreviewCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Popular clubs</h2>
          <SeeAllLink href="/clubs" />
        </div>
        {clubs.length === 0 ? (
          <p className="text-sm text-mute">No clubs yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {clubs.map((club) => (
              <Link
                key={club.id}
                href={`/clubs/${club.id}`}
                className="rounded-card bg-panel border border-white/10 p-4"
              >
                <p className="font-semibold text-sm">{club.name}</p>
                <p className="text-xs text-mute mt-1">
                  {club.city ?? "—"} · {club._count.roster} fighters
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
