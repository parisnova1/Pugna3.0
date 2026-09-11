import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { formatEventDate } from "@/lib/format";
import { geocodeAddress } from "@/lib/geocode";
import { haversineDistanceKm } from "@/lib/geo";
import { SportTag } from "@/components/ui/SportTag";
import { Badge } from "@/components/ui/Badge";
import { SparringNav } from "@/components/sparring/SparringNav";
import { SparringResultsMap } from "@/components/sparring/SparringResultsMap";
import { SparringFilterPanel } from "@/components/sparring/SparringFilterPanel";
import type { MapPoint } from "@/components/home/LiveMap";

const SPORTS = ["Boxing", "Kickboxing", "MMA"];
const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced", "Pro"];
const RADII = [10, 25, 50, 100];
const MODE_LABEL = { INVITE: "Invite only", OPEN_TO_CLUBS: "Open to clubs", OPEN: "Open sparring" } as const;
const MODE_FILTERS: { key: "OPEN" | "OPEN_TO_CLUBS"; label: string }[] = [
  { key: "OPEN", label: "Open sparring" },
  { key: "OPEN_TO_CLUBS", label: "Open to clubs" },
];

function buildModeHref(
  current: { sport?: string; area?: string; radius?: string; sex?: string; experience?: string },
  mode: string | null,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) if (value) params.set(key, value);
  if (mode) params.set("mode", mode);
  const qs = params.toString();
  return `/sparring${qs ? `?${qs}` : ""}`;
}

export default async function SparringDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; area?: string; radius?: string; sex?: string; experience?: string; mode?: string }>;
}) {
  const { sport, area, radius, sex, experience, mode } = await searchParams;
  const actor = await getActor();
  const clubIds = actor?.clubIds ?? [];
  const radiusKm = radius ? Number(radius) : null;
  const activeMode = mode === "OPEN" || mode === "OPEN_TO_CLUBS" ? mode : null;

  const sessions = await prisma.sparringSession.findMany({
    where: {
      status: "OPEN",
      date: { gte: new Date() },
      ...(sport ? { sport } : {}),
      // A plain substring match on city only when there's no real radius search —
      // once a radius is chosen, filtering happens below by actual distance instead.
      ...(area && !radiusKm ? { city: { contains: area, mode: "insensitive" } } : {}),
      ...(sex ? { sex } : {}),
      ...(experience ? { experienceLevel: experience } : {}),
      ...(activeMode ? { accessMode: activeMode } : {}),
      OR: [
        { accessMode: { not: "INVITE" } },
        { clubId: { in: clubIds } },
        { clubInvites: { some: { invitedClubId: { in: clubIds } } } },
      ],
    },
    orderBy: { date: "asc" },
    include: {
      club: true,
      weightGroups: { orderBy: { order: "asc" } },
      _count: { select: { participants: true } },
    },
  });

  // Real geo-radius search: geocode the typed area once, then filter/sort by
  // actual great-circle distance instead of a name substring. Sessions with
  // no coordinates can't be placed, so they drop out of a radius search —
  // falls back to the substring match above if the area doesn't geocode.
  let center: { lat: number; lng: number } | null = null;
  let sessionsInArea = sessions;
  if (area && radiusKm) {
    center = await geocodeAddress(area);
    if (center) {
      const withDistance = sessions
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({ session: s, distanceKm: haversineDistanceKm(center!, { lat: s.latitude!, lng: s.longitude! }) }))
        .filter((s) => s.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
      sessionsInArea = withDistance.map((s) => s.session);
    } else {
      const needle = area.toLowerCase();
      sessionsInArea = sessions.filter((s) => s.city?.toLowerCase().includes(needle));
    }
  }

  const mapPoints: MapPoint[] = sessionsInArea
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ id: s.id, lat: s.latitude!, lng: s.longitude!, label: s.club.name, href: `/sparring/${s.id}` }));

  const activeFilterCount = [sport, area, sex, experience, radius].filter(Boolean).length;

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sparring</h1>
        <Link href="/" aria-label="Go to PUGNA home" className="font-bold tracking-tight text-sm shrink-0">
          PUGNA<span className="text-signal">.</span>
        </Link>
      </div>

      <SparringNav active="discover" registered={Boolean(actor)} />

      <div className="flex gap-2 overflow-x-auto text-sm">
        <Link
          href={buildModeHref({ sport, area, radius, sex, experience }, null)}
          className={[
            "shrink-0 rounded-pill px-4 py-2 font-medium border",
            activeMode === null ? "bg-signal text-onsignal border-signal" : "border-white/15 text-mute",
          ].join(" ")}
        >
          All
        </Link>
        {MODE_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={buildModeHref({ sport, area, radius, sex, experience }, f.key)}
            className={[
              "shrink-0 rounded-pill px-4 py-2 font-medium border whitespace-nowrap",
              activeMode === f.key ? "bg-signal text-onsignal border-signal" : "border-white/15 text-mute",
            ].join(" ")}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <SparringFilterPanel activeCount={activeFilterCount}>
        <form className="grid grid-cols-2 gap-2 text-sm" action="/sparring">
          {mode && <input type="hidden" name="mode" value={mode} />}
          <select name="sport" defaultValue={sport ?? ""} className="rounded-card bg-panel border border-white/10 px-3 py-2 text-ink">
            <option value="">Any sport</option>
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            name="area"
            defaultValue={area ?? ""}
            placeholder="Search an area"
            className="rounded-card bg-panel border border-white/10 px-3 py-2 text-ink placeholder:text-mute"
          />
          <select name="sex" defaultValue={sex ?? ""} className="rounded-card bg-panel border border-white/10 px-3 py-2 text-ink">
            <option value="">Any sex</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <select name="experience" defaultValue={experience ?? ""} className="rounded-card bg-panel border border-white/10 px-3 py-2 text-ink">
            <option value="">Any experience</option>
            {EXPERIENCE_LEVELS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <select name="radius" defaultValue={radius ?? ""} className="rounded-card bg-panel border border-white/10 px-3 py-2 text-ink">
            <option value="">Any distance</option>
            {RADII.map((r) => (
              <option key={r} value={r}>
                Within {r} km
              </option>
            ))}
          </select>
          <button type="submit" className="col-span-2 rounded-pill bg-signal text-onsignal font-semibold py-2.5">
            Apply filters
          </button>
        </form>
      </SparringFilterPanel>

      {area && radiusKm && (
        <p className="text-xs text-mute">
          {center
            ? `Showing sessions within ${radiusKm} km of "${area}", nearest first.`
            : `Couldn't locate "${area}" — showing sessions with a matching city instead.`}
        </p>
      )}

      {mapPoints.length > 0 && <SparringResultsMap points={mapPoints} />}

      <div className="space-y-3">
        {sessionsInArea.length === 0 ? (
          <p className="text-sm text-mute text-center py-10">No open sparring sessions match your filters.</p>
        ) : (
          sessionsInArea.map((session) => (
            <Link
              key={session.id}
              href={`/sparring/${session.id}`}
              className="block rounded-card bg-panel border border-white/10 p-4 hover:border-white/20 transition-colors"
            >
              <div className="flex items-center justify-between">
                <Badge>{MODE_LABEL[session.accessMode]}</Badge>
                <span className="text-xs text-mute tabular">{formatEventDate(session.date)}</span>
              </div>
              <p className="font-semibold mt-2">{session.club.name}</p>
              <p className="text-sm text-mute mt-0.5">
                {session.gym}
                {session.city ? ` · ${session.city}` : ""}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <SportTag>{session.sport}</SportTag>
                {session.weightGroups.map((wg) => (
                  <span key={wg.id} className="text-[11px] text-mute border border-white/10 rounded-pill px-2 py-0.5">
                    {wg.label}
                  </span>
                ))}
              </div>
              <p className="text-xs text-mute mt-2">{session._count.participants} fighter{session._count.participants === 1 ? "" : "s"} registered</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
