import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { haversineDistanceKm } from "@/lib/geo";
import { ClubCard, type ClubCardData } from "@/components/clubs/ClubCard";
import { NearbyToggle } from "@/components/clubs/NearbyToggle";

const SPORTS = ["Boxing", "MMA", "Muay Thai", "Kickboxing"];

function buildQuery(
  current: { q?: string; sport?: string; nearby?: string; lat?: string; lng?: string; verified?: string },
  changes: { sport?: string | null; verified?: string | null },
): string {
  const params = new URLSearchParams();
  if (current.q) params.set("q", current.q);
  if (current.nearby) params.set("nearby", current.nearby);
  if (current.lat) params.set("lat", current.lat);
  if (current.lng) params.set("lng", current.lng);

  const sport = changes.sport !== undefined ? changes.sport : current.sport;
  if (sport) params.set("sport", sport);

  const verified = changes.verified !== undefined ? changes.verified : current.verified;
  if (verified) params.set("verified", verified);

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sport?: string; verified?: string; nearby?: string; lat?: string; lng?: string }>;
}) {
  const { q, sport, verified, nearby, lat, lng } = await searchParams;

  const where: Prisma.ClubWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { roster: { some: { displayName: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
    ...(sport ? { sport } : {}),
    ...(verified ? { isVerified: true } : {}),
  };

  const [featured, allClubs] = await Promise.all([
    // Featured: verified clubs only — omitted entirely below when empty, never an awkward empty section.
    prisma.club.findMany({
      where: { isVerified: true },
      include: { _count: { select: { roster: true, coaches: true } } },
      orderBy: { roster: { _count: "desc" } },
      take: 6,
    }),
    prisma.club.findMany({
      where,
      include: { _count: { select: { roster: true, coaches: true } } },
      orderBy: { name: "asc" },
      take: 60,
    }),
  ]);

  const clubIds = [...featured.map((c) => c.id), ...allClubs.map((c) => c.id)];
  const covers =
    clubIds.length > 0
      ? await prisma.media.findMany({
          where: { attachedType: "CLUB", attachedId: { in: clubIds }, kind: "CLUB_COVER" },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const coverFor = (clubId: string) => covers.find((m) => m.attachedId === clubId)?.url ?? null;

  const toCardData = (club: (typeof allClubs)[number]): ClubCardData => ({
    id: club.id,
    name: club.name,
    city: club.city,
    sport: club.sport,
    isVerified: club.isVerified,
    coverUrl: coverFor(club.id),
    rosterCount: club._count.roster,
    coachCount: club._count.coaches,
  });

  let clubs = allClubs.map(toCardData);

  // Nearby: sort by device-location distance, same semantics as Sparring's
  // existing radius search — clubs with no coordinates just drop out.
  const isNearby = nearby === "1" && lat && lng;
  if (isNearby) {
    const center = { lat: Number(lat), lng: Number(lng) };
    clubs = allClubs
      .filter((c) => c.latitude != null && c.longitude != null)
      .map((c) => ({ club: toCardData(c), distanceKm: haversineDistanceKm(center, { lat: c.latitude!, lng: c.longitude! }) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .map((c) => c.club);
  }

  const featuredCards = featured.map(toCardData);
  const currentParams = { q, sport, verified, nearby, lat, lng };

  return (
    <div className="space-y-8 pb-4">
      <div className="pt-2 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Find your club. Find your people.</h1>
          <p className="text-mute text-sm">Discover boxing clubs and combat-sports communities on PUGNA.</p>
        </div>
        <Link href="/" aria-label="Go to PUGNA home" className="font-bold tracking-tight text-sm shrink-0">
          PUGNA<span className="text-signal">.</span>
        </Link>
      </div>

      <form className="relative">
        {sport && <input type="hidden" name="sport" value={sport} />}
        {verified && <input type="hidden" name="verified" value={verified} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search clubs, cities or athletes..."
          className="w-full rounded-card bg-panel border border-white/10 px-4 py-3.5 text-ink placeholder:text-mute"
        />
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link
          href={`/clubs${buildQuery(currentParams, { sport: null })}`}
          className={[
            "shrink-0 rounded-pill px-4 py-2 text-sm font-medium border",
            !sport ? "bg-ink text-void border-ink" : "border-white/15 text-mute",
          ].join(" ")}
        >
          All
        </Link>
        {SPORTS.map((s) => (
          <Link
            key={s}
            href={`/clubs${buildQuery(currentParams, { sport: s })}`}
            className={[
              "shrink-0 rounded-pill px-4 py-2 text-sm font-medium border",
              sport === s ? "bg-ink text-void border-ink" : "border-white/15 text-mute",
            ].join(" ")}
          >
            {s}
          </Link>
        ))}
        <NearbyToggle active={Boolean(isNearby)} />
        <Link
          href={`/clubs${buildQuery(currentParams, { verified: verified ? null : "1" })}`}
          className={[
            "shrink-0 rounded-pill px-4 py-2 text-sm font-medium border",
            verified ? "bg-ink text-void border-ink" : "border-white/15 text-mute",
          ].join(" ")}
        >
          PUGNA Verified
        </Link>
      </div>

      {featuredCards.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Featured Clubs</p>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 sm:overflow-visible">
            {featuredCards.map((club) => (
              <div key={club.id} className="w-72 shrink-0 sm:w-auto">
                <ClubCard club={club} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">All Clubs</p>
        {clubs.length === 0 ? (
          <div className="text-center py-14 space-y-1">
            <p className="text-sm font-medium">No clubs found</p>
            <p className="text-xs text-mute">Try another club name, city or sport.</p>
          </div>
        ) : (
          <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
            {clubs.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
