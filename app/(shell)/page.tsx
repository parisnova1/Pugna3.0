import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { formatEventDate, formatCountdown } from "@/lib/format";
import { EventPreviewCard } from "@/components/event/EventPreviewCard";
import { SeeAllLink } from "@/components/event/SeeAllLink";
import { EventCodeBar } from "@/components/event/EventCodeBar";

export default async function HomePage() {
  const actor = await getActor();

  const [live, upcoming, clubs, following, openSparring] = await Promise.all([
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
    prisma.sparringSession.findMany({
      where: { status: "OPEN", date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 4,
      include: { club: true, weightGroups: { orderBy: { order: "asc" }, take: 1 } },
    }),
  ]);

  const eventIds = [...live, ...upcoming, ...following].map((e) => e.id);
  const covers =
    eventIds.length > 0
      ? await prisma.media.findMany({
          where: { attachedType: "EVENT", attachedId: { in: eventIds }, kind: "EVENT_COVER" },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const coverFor = (eventId: string) => covers.find((m) => m.attachedId === eventId)?.url ?? null;

  const yourPugna = actor
    ? await (async () => {
        const [fighter, unreadCount] = await Promise.all([
          prisma.fighterProfile.findUnique({ where: { userId: actor.userId } }),
          prisma.notification.count({ where: { userId: actor.userId, read: false } }),
        ]);
        const nextBout = fighter
          ? await prisma.bout.findFirst({
              where: {
                OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }],
                status: { in: ["CONFIRMED", "READY", "DELAYED", "IN_PROGRESS"] },
              },
              include: { event: true, fighterA: true, fighterB: true },
              orderBy: { scheduledTime: "asc" },
            })
          : null;
        return { fighter, unreadCount, nextBout };
      })()
    : null;

  return (
    <div className="space-y-10">
      <section className="space-y-3 pt-2">
        <h1 className="text-4xl font-bold leading-none tracking-tight">PUGNA</h1>
        <p className="text-lg font-semibold text-ink">Train. Match. Compete. Track.</p>
        <p className="text-mute text-sm">The operating system for combat sports.</p>
        <EventCodeBar />
        <div className="flex gap-2 pt-1">
          <Link href="/events" className="rounded-pill border border-white/20 text-ink font-semibold px-5 py-3 text-sm">
            Explore Events
          </Link>
          <Link href="/sparring" className="rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm">
            Find Sparring
          </Link>
        </div>
      </section>

      {live.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Live now</h2>
          <div className="space-y-3">
            {live.map((event) => (
              <EventPreviewCard key={event.id} event={event} coverUrl={coverFor(event.id)} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Open sparring near you</h2>
          <SeeAllLink href="/sparring" />
        </div>
        {openSparring.length === 0 ? (
          <p className="text-sm text-mute">No open sparring sessions right now.</p>
        ) : (
          <div className="space-y-3">
            {openSparring.map((session) => (
              <Link
                key={session.id}
                href={`/sparring/${session.id}`}
                className="block rounded-card bg-panel border border-white/10 p-4 hover:border-white/20 transition-colors"
              >
                <p className="font-semibold text-sm">{session.club.name}</p>
                <p className="text-xs text-mute mt-1">
                  {session.gym} · {formatEventDate(session.date)}
                  {session.weightGroups[0] ? ` · ${session.weightGroups[0].label}` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {following.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Following</h2>
          <div className="space-y-3">
            {following.map((event) => (
              <EventPreviewCard key={event.id} event={event} coverUrl={coverFor(event.id)} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Upcoming events</h2>
          <SeeAllLink href="/events" />
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-mute">No events nearby yet.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((event) => (
              <EventPreviewCard key={event.id} event={event} coverUrl={coverFor(event.id)} />
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

      {yourPugna && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Your Pugna</h2>
          <div className="rounded-card bg-panel border border-white/10 p-4 space-y-3">
            {yourPugna.nextBout ? (
              <div>
                <p className="text-xs font-semibold text-mute uppercase tracking-wide mb-1">Next</p>
                <p className="text-sm font-medium">
                  vs{" "}
                  {yourPugna.nextBout.fighterAId === yourPugna.fighter?.id
                    ? yourPugna.nextBout.fighterB?.displayName ?? "TBA"
                    : yourPugna.nextBout.fighterA?.displayName ?? "TBA"}
                </p>
                <p className="text-xs text-signal mt-0.5">
                  {yourPugna.nextBout.status === "IN_PROGRESS"
                    ? "Live"
                    : yourPugna.nextBout.event.startTime
                      ? formatCountdown(yourPugna.nextBout.event.startTime)
                      : "Scheduled"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-mute">No upcoming fights.</p>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-mute">
              <Link href="/you/notifications" className="underline">
                {yourPugna.unreadCount > 0 ? `${yourPugna.unreadCount} new notification${yourPugna.unreadCount > 1 ? "s" : ""}` : "Notifications"}
              </Link>
              <Link href="/account" className="underline">
                My Pugna
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
