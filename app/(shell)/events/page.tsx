import Link from "next/link";
import type { EventStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { haversineDistanceKm } from "@/lib/geo";
import { EventPreviewCard } from "@/components/event/EventPreviewCard";
import { NearbyToggle } from "@/components/clubs/NearbyToggle";
import { OrganizerHome } from "@/components/account/OrganizerHome";
import { buildMetadata } from "@/lib/seo";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getUnreadCount } from "@/lib/notifications-query";
import { DAY_MS, LOOKBACK_MS, hasEnded, liveFirst, spansDay, utcDayStart } from "@/lib/event-timing";

type Filter = "live" | "today" | "week" | "upcoming" | "finished" | "tournaments" | "fightNights";

const LIVE_ISH: EventStatus[] = ["PUBLISHED", "LIVE", "INTERMISSION"];
const LIVE_ONLY: EventStatus[] = ["LIVE", "INTERMISSION"];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "upcoming", label: "Upcoming" },
  { key: "finished", label: "Past" },
  { key: "tournaments", label: "Tournaments" },
  { key: "fightNights", label: "Fight Nights" },
];

function buildQuery(
  current: { q?: string; filter?: Filter; nearby?: string; lat?: string; lng?: string; saved?: string },
  changes: { filter?: Filter | null; nearby?: string | null; saved?: string | null },
): string {
  const params = new URLSearchParams();
  if (current.q) params.set("q", current.q);
  if (current.lat) params.set("lat", current.lat);
  if (current.lng) params.set("lng", current.lng);

  const filter = changes.filter !== undefined ? changes.filter : current.filter;
  if (filter) params.set("filter", filter);

  const nearby = changes.nearby !== undefined ? changes.nearby : current.nearby;
  if (nearby) params.set("nearby", nearby);

  const saved = changes.saved !== undefined ? changes.saved : current.saved;
  if (saved) params.set("saved", saved);

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const metadata = buildMetadata({
  title: "Combat sports events",
  description: "Upcoming and live boxing and combat sports events. Follow fight cards, schedules and results on PUGNA.",
  path: "/events",
});

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: Filter; nearby?: string; lat?: string; lng?: string; saved?: string }>;
}) {
  const { q, filter = "upcoming", nearby, lat, lng, saved } = await searchParams;
  const actor = await getActor();

  // The Events tab is the Organizer's command center — hosting/managing/
  // controlling events is their reason to open the app, not browsing the
  // public events list (which stays exactly as-is for everyone else).
  if (actor?.isOrganizer) {
    const unreadCount = await getUnreadCount(actor.userId);
    return <OrganizerHome actor={actor} unreadCount={unreadCount} />;
  }

  const now = new Date();
  const todayStart = utcDayStart(now);
  const weekEnd = todayStart + 7 * DAY_MS;

  // Tournaments vs Fight Nights is a derived split, not stored data — no `EventType`
  // field exists in the schema. A tournament is any event with more than one day or
  // ring; everything else reads as a single-card fight night.
  const isTournament: Prisma.EventWhereInput = { OR: [{ dayCount: { gt: 1 } }, { ringCount: { gt: 1 } }] };
  const isFightNight: Prisma.EventWhereInput = { dayCount: { lte: 1 }, ringCount: { lte: 1 } };

  // A tab's meaning depends on the clock, not just the stored status: a host who
  // never pressed "Finish" leaves an event on PUBLISHED/LIVE indefinitely. The
  // database narrows by status and a generous date window; the exact "has it
  // ended / is it today" test below is the single source of truth (lib/event-timing).
  const statusWhere: Prisma.EventWhereInput =
    filter === "finished"
      ? { OR: [{ status: "FINISHED" }, { status: { in: LIVE_ISH }, date: { lt: now } }] }
      : {
          status: { in: filter === "live" ? LIVE_ONLY : LIVE_ISH },
          date: { gte: new Date(now.getTime() - LOOKBACK_MS) },
          ...(filter === "tournaments" ? isTournament : filter === "fightNights" ? isFightNight : {}),
        };

  const textWhere: Prisma.EventWhereInput | null = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { venue: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
          { sport: { contains: q, mode: "insensitive" } },
        ],
      }
    : null;

  const savedRequested = saved === "1";
  const isSaved = savedRequested && Boolean(actor);
  const savedWhere: Prisma.EventWhereInput | null = isSaved ? { follows: { some: { userId: actor!.userId } } } : null;

  const where: Prisma.EventWhereInput = {
    AND: [statusWhere, ...(textWhere ? [textWhere] : []), ...(savedWhere ? [savedWhere] : [])],
  };

  const isNearby = nearby === "1" && lat && lng;

  const matchesTab = (e: { status: EventStatus; date: Date; dayCount: number }): boolean => {
    const ended = hasEnded(e, now);
    if (filter === "finished") return e.status === "FINISHED" || ended;
    if (filter === "today") return !ended && spansDay(e, todayStart);
    if (filter === "week") return !ended && utcDayStart(e.date) < weekEnd;
    return !ended; // live, upcoming, tournaments, fight nights
  };

  const candidates = await prisma.event.findMany({
    where,
    orderBy: { date: filter === "finished" ? "desc" : "asc" },
    take: 150,
  });
  let events = candidates.filter(matchesTab);
  if (filter !== "finished") events = liveFirst(events);

  if (isNearby) {
    const center = { lat: Number(lat), lng: Number(lng) };
    events = events
      .filter((e) => e.latitude != null && e.longitude != null)
      .sort(
        (a, b) =>
          haversineDistanceKm(center, { lat: a.latitude!, lng: a.longitude! }) -
          haversineDistanceKm(center, { lat: b.latitude!, lng: b.longitude! }),
      );
  }
  events = events.slice(0, 30);

  const eventIds = events.map((e) => e.id);
  const [checkIns, covers] =
    eventIds.length > 0
      ? await Promise.all([
          prisma.checkIn.findMany({
            where: { attachedType: "EVENT", attachedId: { in: eventIds }, status: "CHECKED_IN" },
            select: { attachedId: true },
          }),
          prisma.media.findMany({
            where: { attachedType: "EVENT", attachedId: { in: eventIds }, kind: "EVENT_COVER" },
            orderBy: { createdAt: "desc" },
          }),
        ])
      : [[], []];
  const checkedInCountFor = (eventId: string) => checkIns.filter((c) => c.attachedId === eventId).length;
  const coverFor = (eventId: string) => covers.find((m) => m.attachedId === eventId)?.url ?? null;

  const currentParams = { q, filter, nearby, lat, lng, saved };

  // Say what is actually true, not "nothing nearby" for every kind of empty list.
  const emptyCopy = q
    ? `No events match "${q}".`
    : isNearby
      ? "No events with a location near you right now."
      : isSaved
        ? "You haven't saved any events yet."
        : filter === "finished"
          ? "No past events yet."
          : filter === "live"
            ? "Nothing is live right now."
            : filter === "today"
              ? "No events today."
              : filter === "week"
                ? "No events in the next 7 days."
                : "No upcoming events right now. Check back soon, or look at past events and clubs.";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Link href="/" aria-label="Go to PUGNA home" className="font-bold tracking-tight text-sm shrink-0">
          PUGNA<span className="text-signal-ink">.</span>
        </Link>
      </div>

      <form className="relative">
        {filter && filter !== "upcoming" && <input type="hidden" name="filter" value={filter} />}
        {nearby && <input type="hidden" name="nearby" value={nearby} />}
        {lat && <input type="hidden" name="lat" value={lat} />}
        {lng && <input type="hidden" name="lng" value={lng} />}
        {saved && <input type="hidden" name="saved" value={saved} />}
        <input
          name="q"
          type="search"
          aria-label="Search events, clubs and cities"
          enterKeyHint="search"
          defaultValue={q}
          placeholder="Search events, clubs, cities..."
          className="w-full rounded-card bg-panel border border-white/10 px-4 py-3.5 text-ink placeholder:text-mute"
        />
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            aria-current={filter === f.key ? "true" : undefined}
            href={`/events${buildQuery(currentParams, { filter: f.key === "upcoming" ? null : f.key })}`}
            className={[
              "shrink-0 rounded-pill px-4 py-2 text-sm font-medium border",
              filter === f.key ? "bg-ink text-void border-ink" : "border-white/15 text-mute",
            ].join(" ")}
          >
            {f.label}
          </Link>
        ))}
        <NearbyToggle active={Boolean(isNearby)} basePath="/events" />
        <Link
          href={`/events${buildQuery(currentParams, { saved: savedRequested ? null : "1" })}`}
          className={[
            "shrink-0 rounded-pill px-4 py-2 text-sm font-medium border",
            savedRequested ? "bg-ink text-void border-ink" : "border-white/15 text-mute",
          ].join(" ")}
        >
          Saved
        </Link>
      </div>

      {savedRequested && !actor && (
        <p className="text-sm text-mute">
          <Link href="/account" className="underline">
            Sign in
          </Link>{" "}
          to see events you&apos;ve saved.
        </p>
      )}

      {events.length === 0 ? (
        <div className="text-center py-14 space-y-4">
          <EmptyState>{emptyCopy}</EmptyState>
          <div className="flex flex-wrap justify-center gap-2">
            {filter !== "finished" && (
              <Link href="/events?filter=finished" className={buttonClass({ variant: "outline", text: "sm", className: "inline-block px-5" })}>
                See past events
              </Link>
            )}
            <Link href="/clubs" className={buttonClass({ variant: "outline", text: "sm", className: "inline-block px-5" })}>
              Explore clubs
            </Link>
            <Link href="/sparring" className={buttonClass({ variant: "outline", text: "sm", className: "inline-block px-5" })}>
              Find sparring
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventPreviewCard
              key={event.id}
              event={event}
              coverUrl={coverFor(event.id)}
              checkedInCount={checkedInCountFor(event.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
