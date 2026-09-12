import Link from "next/link";
import type { EventStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { haversineDistanceKm } from "@/lib/geo";
import { EventPreviewCard } from "@/components/event/EventPreviewCard";
import { NearbyToggle } from "@/components/clubs/NearbyToggle";

type Filter = "live" | "today" | "week" | "upcoming" | "finished" | "tournaments" | "fightNights";

const LIVE_ISH: EventStatus[] = ["PUBLISHED", "LIVE", "INTERMISSION"];
const LIVE_ONLY: EventStatus[] = ["LIVE", "INTERMISSION"];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "upcoming", label: "Upcoming" },
  { key: "finished", label: "Finished" },
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

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: Filter; nearby?: string; lat?: string; lng?: string; saved?: string }>;
}) {
  const { q, filter = "upcoming", nearby, lat, lng, saved } = await searchParams;
  const actor = await getActor();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Tournaments vs Fight Nights is a derived split, not stored data — no `EventType`
  // field exists in the schema. A tournament is any event with more than one day or
  // ring; everything else reads as a single-card fight night.
  const isTournament: Prisma.EventWhereInput = { OR: [{ dayCount: { gt: 1 } }, { ringCount: { gt: 1 } }] };
  const isFightNight: Prisma.EventWhereInput = { dayCount: { lte: 1 }, ringCount: { lte: 1 } };

  const statusWhere: Prisma.EventWhereInput =
    filter === "live"
      ? { status: { in: LIVE_ONLY } }
      : filter === "today"
        ? { date: { gte: startOfDay, lt: endOfDay }, status: { in: LIVE_ISH } }
        : filter === "week"
          ? { date: { gte: startOfDay, lt: endOfWeek }, status: { in: LIVE_ISH } }
          : filter === "finished"
            ? { status: "FINISHED" }
            : filter === "tournaments"
              ? { status: { in: LIVE_ISH }, ...isTournament }
              : filter === "fightNights"
                ? { status: { in: LIVE_ISH }, ...isFightNight }
                : { status: { in: LIVE_ISH } };

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

  let events = await prisma.event.findMany({
    where,
    orderBy: { date: filter === "finished" ? "desc" : "asc" },
    take: isNearby ? undefined : 30,
  });

  if (isNearby) {
    const center = { lat: Number(lat), lng: Number(lng) };
    events = events
      .filter((e) => e.latitude != null && e.longitude != null)
      .sort(
        (a, b) =>
          haversineDistanceKm(center, { lat: a.latitude!, lng: a.longitude! }) -
          haversineDistanceKm(center, { lat: b.latitude!, lng: b.longitude! }),
      )
      .slice(0, 30);
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Link href="/" aria-label="Go to PUGNA home" className="font-bold tracking-tight text-sm shrink-0">
          PUGNA<span className="text-signal">.</span>
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
          defaultValue={q}
          placeholder="Search events, clubs, cities..."
          className="w-full rounded-card bg-panel border border-white/10 px-4 py-3.5 text-ink placeholder:text-mute"
        />
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
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
        <div className="text-center py-16 space-y-4">
          <p className="text-mute text-sm">No events nearby yet.</p>
          <Link href="/scan" className="inline-block rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm">
            Scan QR
          </Link>
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
