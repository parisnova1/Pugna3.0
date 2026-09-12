import Link from "next/link";
import type { EventStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { formatCountdown, formatEventDate } from "@/lib/format";
import { haversineDistanceKm } from "@/lib/geo";
import { SeeAllLink } from "@/components/event/SeeAllLink";
import { HomeTabs } from "@/components/home/HomeTabs";
import { Badge } from "@/components/ui/Badge";
import { NearbyToggle } from "@/components/clubs/NearbyToggle";

const NEARBY_EVENT_STATUSES: EventStatus[] = ["PUBLISHED", "LIVE", "INTERMISSION"];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ nearby?: string; lat?: string; lng?: string }>;
}) {
  const { nearby, lat, lng } = await searchParams;
  const actor = await getActor();
  const isNearby = nearby === "1" && lat && lng;

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

  // Near You — opt-in device geolocation, same one-tap pattern as /clubs's
  // NearbyToggle. Rows with no stored coordinates never appear; never a
  // fabricated "near you" placeholder when the user hasn't opted in.
  const nearYou = isNearby
    ? await (async () => {
        const center = { lat: Number(lat), lng: Number(lng) };
        const withDistance = <T extends { latitude: number | null; longitude: number | null }>(rows: T[]) =>
          rows
            .filter((r) => r.latitude != null && r.longitude != null)
            .map((r) => ({ row: r, distanceKm: haversineDistanceKm(center, { lat: r.latitude!, lng: r.longitude! }) }))
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .map((r) => r.row);

        const [nearEvents, nearClubs, nearSparring] = await Promise.all([
          prisma.event.findMany({ where: { status: { in: NEARBY_EVENT_STATUSES }, latitude: { not: null } }, take: 20 }),
          prisma.club.findMany({ where: { latitude: { not: null } }, take: 20 }),
          prisma.sparringSession.findMany({
            where: { status: "OPEN", date: { gte: new Date() }, latitude: { not: null } },
            include: { club: true },
            take: 20,
          }),
        ]);

        return {
          events: withDistance(nearEvents).slice(0, 3),
          clubs: withDistance(nearClubs).slice(0, 2),
          sparring: withDistance(nearSparring).slice(0, 2),
        };
      })()
    : null;
  const hasNearYou = nearYou && (nearYou.events.length > 0 || nearYou.clubs.length > 0 || nearYou.sparring.length > 0);

  // Latest on PUGNA — a small deterministic mix of what's actually recent, not a new
  // social feed model: the most recent finished result, the freshest live event, the
  // most recently published event, and the newest club. Any item with no real data
  // is simply omitted.
  const [latestResult, latestPublishedEvent] = await Promise.all([
    prisma.bout.findFirst({
      where: { status: "FINAL" },
      include: { fighterA: true, fighterB: true, result: true, event: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.event.findFirst({
      where: { status: { in: ["PUBLISHED", "LIVE", "INTERMISSION", "FINISHED"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const latestLiveEvent = live[0] ?? null;
  const latestClub = clubs[0] ?? null;

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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Near you</h2>
          <NearbyToggle active={Boolean(isNearby)} basePath="/" />
        </div>
        {isNearby && !hasNearYou && <p className="text-sm text-mute">Nothing near you yet.</p>}
        {hasNearYou && (
          <div className="space-y-2">
            {nearYou!.events.map((e) => (
              <Link
                key={e.id}
                href={e.slug ? `/e/${e.slug}` : "#"}
                className="block rounded-card bg-panel border border-white/10 p-3"
              >
                <p className="text-sm font-medium">{e.name}</p>
                <p className="text-xs text-mute mt-0.5">{[e.city, formatEventDate(e.date)].filter(Boolean).join(" · ")}</p>
              </Link>
            ))}
            {nearYou!.clubs.map((c) => (
              <Link key={c.id} href={`/clubs/${c.id}`} className="block rounded-card bg-panel border border-white/10 p-3">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-mute mt-0.5">{c.city ?? "Club"}</p>
              </Link>
            ))}
            {nearYou!.sparring.map((s) => (
              <Link key={s.id} href={`/sparring/${s.id}`} className="block rounded-card bg-panel border border-white/10 p-3">
                <p className="text-sm font-medium">{s.club.name} · Sparring</p>
                <p className="text-xs text-mute mt-0.5">{[s.city, formatEventDate(s.date)].filter(Boolean).join(" · ")}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {(latestResult || latestLiveEvent || latestPublishedEvent || latestClub) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Latest on PUGNA</h2>
          <div className="space-y-2">
            {latestLiveEvent && latestLiveEvent.slug && (
              <Link
                href={`/e/${latestLiveEvent.slug}`}
                className="block rounded-card bg-panel border border-white/10 p-4"
              >
                <Badge live tone="live">
                  LIVE
                </Badge>
                <p className="text-sm font-semibold mt-2">{latestLiveEvent.name}</p>
                <p className="text-xs text-mute mt-0.5">{latestLiveEvent.city ?? latestLiveEvent.venue}</p>
              </Link>
            )}
            {latestResult && latestResult.result && latestResult.event.slug && (
              <Link
                href={`/e/${latestResult.event.slug}/bout/${latestResult.id}`}
                className="block rounded-card bg-panel border border-white/10 p-4"
              >
                <p className="text-xs font-semibold text-mute uppercase tracking-wide">Final</p>
                <p className="text-sm font-semibold mt-1">
                  <span className="text-success">
                    {latestResult.result.winnerId === latestResult.fighterAId
                      ? latestResult.fighterA?.displayName
                      : latestResult.fighterB?.displayName}{" "}
                    🏆
                  </span>
                </p>
                <p className="text-xs text-mute mt-0.5">
                  {latestResult.result.method}
                  {latestResult.result.round ? ` · Round ${latestResult.result.round}` : ""} · {latestResult.event.name}
                </p>
              </Link>
            )}
            {latestPublishedEvent && latestPublishedEvent.slug && latestPublishedEvent.id !== latestLiveEvent?.id && (
              <Link
                href={`/e/${latestPublishedEvent.slug}`}
                className="block rounded-card bg-panel border border-white/10 p-4"
              >
                <p className="text-sm font-semibold">{latestPublishedEvent.name}</p>
                <p className="text-xs text-mute mt-0.5">
                  {[latestPublishedEvent.city, formatEventDate(latestPublishedEvent.date)].filter(Boolean).join(" · ")}
                </p>
              </Link>
            )}
            {latestClub && (
              <Link href={`/clubs/${latestClub.id}`} className="block rounded-card bg-panel border border-white/10 p-4">
                <p className="text-sm font-semibold">{latestClub.name}</p>
                <p className="text-xs text-mute mt-0.5">{latestClub.city ?? "Club"} on PUGNA</p>
              </Link>
            )}
          </div>
        </section>
      )}

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
