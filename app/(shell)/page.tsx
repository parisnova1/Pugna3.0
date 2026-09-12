import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { formatCountdown } from "@/lib/format";
import { SeeAllLink } from "@/components/event/SeeAllLink";
import { HomeTabs } from "@/components/home/HomeTabs";
import { Badge } from "@/components/ui/Badge";

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
      select: { id: true, name: true, city: true, isVerified: true, _count: { select: { roster: true } } },
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
  const [covers, checkIns] =
    eventIds.length > 0
      ? await Promise.all([
          prisma.media.findMany({
            where: { attachedType: "EVENT", attachedId: { in: eventIds }, kind: "EVENT_COVER" },
            orderBy: { createdAt: "desc" },
          }),
          prisma.checkIn.findMany({
            where: { attachedType: "EVENT", attachedId: { in: eventIds }, status: "CHECKED_IN" },
            select: { attachedId: true },
          }),
        ])
      : [[], []];
  const coverFor = (eventId: string) => covers.find((m) => m.attachedId === eventId)?.url ?? null;
  const checkedInCountFor = (eventId: string) => checkIns.filter((c) => c.attachedId === eventId).length;
  const withCover = <T extends { id: string }>(events: T[]) =>
    events.map((e) => ({ ...e, coverUrl: coverFor(e.id), checkedInCount: checkedInCountFor(e.id) }));
  const followingIds = new Set(following.map((e) => e.id));
  const liveWithCover = withCover(live);
  // Followed events get their own priority section (in HomeTabs, above
  // Upcoming) — drop them here so they don't show twice.
  const upcomingWithCover = withCover(upcoming.filter((e) => !followingIds.has(e.id)));
  const followingWithCover = withCover(following);

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
      <section className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-2xl font-bold leading-none tracking-tight">
            PUGNA<span className="text-signal">.</span>
          </h1>
          <p className="text-mute text-xs mt-1">Find your next fight — events, sparring &amp; clubs, all in one place.</p>
        </div>
        <Link href="/account" aria-label="Account" className="rounded-full border border-white/15 p-2.5 shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
          </svg>
        </Link>
      </section>

      <Link
        href="/search"
        className="flex items-center gap-2 rounded-pill bg-panel border border-white/10 px-4 py-3 text-sm text-mute"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        Search events, boxers, clubs...
      </Link>

      <HomeTabs live={liveWithCover} upcoming={upcomingWithCover} following={followingWithCover} openSparring={openSparring} />

      <section className="rounded-card bg-panel border border-white/10 p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Going to an event?</p>
          <p className="text-xs text-mute mt-0.5">Scan your PUGNA QR code to check in and follow the action.</p>
        </div>
        <Link href="/scan" className="shrink-0 rounded-pill bg-signal text-onsignal text-sm font-semibold px-4 py-2">
          Scan
        </Link>
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
                {club.isVerified && (
                  <div className="mt-2">
                    <Badge tone="success">✓ Verified</Badge>
                  </div>
                )}
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
                <p className={`text-xs mt-0.5 ${yourPugna.nextBout.status === "IN_PROGRESS" ? "text-live" : "text-signal"}`}>
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
