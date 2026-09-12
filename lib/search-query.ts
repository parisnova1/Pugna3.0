import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";
import type { Prisma, EventStatus, MediaAttachedType, MediaKind } from "@prisma/client";

const CANDIDATE_LIMIT = 20;

export type SearchResultKind = "event" | "fighter" | "club" | "sparring";

export type SearchResult = {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: { text: string; tone: "live" | "success" };
  thumbnailUrl?: string;
};

/** Batched Media lookup for a candidate set — one query per entity search, never one per row. */
async function thumbnailsFor(attachedType: MediaAttachedType, kind: MediaKind, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await prisma.media.findMany({
    where: { attachedType, kind, attachedId: { in: ids } },
    orderBy: { createdAt: "desc" },
  });
  const map = new Map<string, string>();
  for (const row of rows) if (!map.has(row.attachedId)) map.set(row.attachedId, row.url);
  return map;
}

/** Simple structured relevance rank (0 = exact match, 1 = prefix, 2 = contains) across a set of
 * candidate fields — not a search engine, just enough to satisfy "exact > prefix > substring"
 * without a new dependency. Candidates are already DB-filtered to matching rows, so this only
 * ever re-orders, never re-filters. */
function rank(q: string, ...fields: (string | null | undefined)[]): number {
  const needle = q.trim().toLowerCase();
  let best = 2;
  for (const f of fields) {
    if (!f) continue;
    const hay = f.toLowerCase();
    if (hay === needle) return 0;
    if (hay.startsWith(needle)) best = Math.min(best, 1);
  }
  return best;
}

const EVENT_VISIBLE_STATUSES: EventStatus[] = ["PUBLISHED", "LIVE", "INTERMISSION", "FINISHED"];

export async function searchEvents(q: string, limit = 8): Promise<SearchResult[]> {
  const trimmed = q.trim();
  const where: Prisma.EventWhereInput = {
    status: { in: EVENT_VISIBLE_STATUSES },
    slug: { not: null },
    ...(trimmed
      ? {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" } },
            { venue: { contains: trimmed, mode: "insensitive" } },
            { city: { contains: trimmed, mode: "insensitive" } },
            { sport: { contains: trimmed, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const events = await prisma.event.findMany({ where, orderBy: { date: "asc" }, take: CANDIDATE_LIMIT });
  const ranked = trimmed
    ? [...events].sort((a, b) => rank(trimmed, a.name, a.venue, a.city, a.sport) - rank(trimmed, b.name, b.venue, b.city, b.sport))
    : events;
  const sliced = ranked.slice(0, limit);
  const covers = await thumbnailsFor("EVENT", "EVENT_COVER", sliced.map((e) => e.id));

  return sliced.map((e) => ({
    kind: "event",
    id: e.id,
    title: e.name,
    subtitle: [e.venue ?? e.city, formatEventDate(e.date)].filter(Boolean).join(" · "),
    href: `/e/${e.slug}`,
    badge: e.status === "LIVE" || e.status === "INTERMISSION" ? { text: "LIVE", tone: "live" } : undefined,
    thumbnailUrl: covers.get(e.id),
  }));
}

export async function searchFighters(q: string, limit = 8): Promise<SearchResult[]> {
  const trimmed = q.trim();
  const where: Prisma.FighterProfileWhereInput = trimmed
    ? {
        OR: [
          { displayName: { contains: trimmed, mode: "insensitive" } },
          { weightClass: { contains: trimmed, mode: "insensitive" } },
        ],
      }
    : {};

  const fighters = await prisma.fighterProfile.findMany({
    where,
    include: { club: true },
    orderBy: { displayName: "asc" },
    take: CANDIDATE_LIMIT,
  });
  const ranked = trimmed
    ? [...fighters].sort((a, b) => rank(trimmed, a.displayName, a.weightClass) - rank(trimmed, b.displayName, b.weightClass))
    : fighters;
  const sliced = ranked.slice(0, limit);
  const avatars = await thumbnailsFor("FIGHTER", "FIGHTER_AVATAR", sliced.map((f) => f.id));

  return sliced.map((f) => ({
    kind: "fighter",
    id: f.id,
    title: f.displayName,
    subtitle: [f.club?.name ?? "Independent", f.weightClass].filter(Boolean).join(" · "),
    href: `/fighters/${f.id}`,
    thumbnailUrl: avatars.get(f.id),
  }));
}

export async function searchClubs(q: string, limit = 8): Promise<SearchResult[]> {
  const trimmed = q.trim();
  const where: Prisma.ClubWhereInput = trimmed
    ? {
        OR: [
          { name: { contains: trimmed, mode: "insensitive" } },
          { city: { contains: trimmed, mode: "insensitive" } },
          { sport: { contains: trimmed, mode: "insensitive" } },
        ],
      }
    : {};

  const clubs = await prisma.club.findMany({
    where,
    include: { _count: { select: { roster: true } } },
    orderBy: { name: "asc" },
    take: CANDIDATE_LIMIT,
  });
  const ranked = trimmed
    ? [...clubs].sort((a, b) => rank(trimmed, a.name, a.city, a.sport) - rank(trimmed, b.name, b.city, b.sport))
    : clubs;
  const sliced = ranked.slice(0, limit);
  const covers = await thumbnailsFor("CLUB", "CLUB_COVER", sliced.map((c) => c.id));

  return sliced.map((c) => ({
    kind: "club",
    id: c.id,
    title: c.name,
    subtitle: [c.city, `${c._count.roster} fighter${c._count.roster === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
    href: `/clubs/${c.id}`,
    badge: undefined,
    thumbnailUrl: covers.get(c.id),
  }));
}

export async function searchSparring(q: string, clubIds: string[], limit = 8): Promise<SearchResult[]> {
  const trimmed = q.trim();

  // Same "who can see an INVITE session" rule as app/(shell)/sparring/page.tsx.
  const accessGate: Prisma.SparringSessionWhereInput = {
    OR: [
      { accessMode: { not: "INVITE" } },
      { clubId: { in: clubIds } },
      { clubInvites: { some: { invitedClubId: { in: clubIds } } } },
    ],
  };
  const textGate: Prisma.SparringSessionWhereInput | null = trimmed
    ? {
        OR: [
          { gym: { contains: trimmed, mode: "insensitive" } },
          { city: { contains: trimmed, mode: "insensitive" } },
          { sport: { contains: trimmed, mode: "insensitive" } },
          { weightGroups: { some: { label: { contains: trimmed, mode: "insensitive" } } } },
        ],
      }
    : null;

  const sessions = await prisma.sparringSession.findMany({
    where: {
      status: "OPEN",
      date: { gte: new Date() },
      AND: textGate ? [accessGate, textGate] : [accessGate],
    },
    include: { club: true, weightGroups: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: { date: "asc" },
    take: CANDIDATE_LIMIT,
  });

  const ranked = trimmed
    ? [...sessions].sort(
        (a, b) =>
          rank(trimmed, a.gym, a.city, a.sport, ...a.weightGroups.map((w) => w.label)) -
          rank(trimmed, b.gym, b.city, b.sport, ...b.weightGroups.map((w) => w.label)),
      )
    : sessions;

  return ranked.slice(0, limit).map((s) => ({
    kind: "sparring",
    id: s.id,
    title: s.club.name,
    subtitle: [s.weightGroups[0]?.label, formatEventDate(s.date)].filter(Boolean).join(" · "),
    href: `/sparring/${s.id}`,
  }));
}

export async function searchAll(
  q: string,
  actor: { clubIds: string[] } | null,
): Promise<{ events: SearchResult[]; fighters: SearchResult[]; clubs: SearchResult[]; sparring: SearchResult[] }> {
  const [events, fighters, clubs, sparring] = await Promise.all([
    searchEvents(q),
    searchFighters(q),
    searchClubs(q),
    searchSparring(q, actor?.clubIds ?? []),
  ]);
  return { events, fighters, clubs, sparring };
}
