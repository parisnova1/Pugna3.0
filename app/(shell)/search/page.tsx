import Link from "next/link";
import { getActor } from "@/lib/actor";
import { BackButton } from "@/components/event/ContextBar";
import { SearchInput } from "@/components/search/SearchInput";
import { SearchResultRow } from "@/components/search/SearchResultRow";
import { searchEvents, searchFighters, searchClubs, searchSparring, searchAll, type SearchResult } from "@/lib/search-query";

type SearchType = "all" | "events" | "fighters" | "clubs" | "sparring";
const VALID_TYPES: SearchType[] = ["all", "events", "fighters", "clubs", "sparring"];

const FILTERS: { key: SearchType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "events", label: "Events" },
  { key: "fighters", label: "Boxers" },
  { key: "clubs", label: "Clubs" },
  { key: "sparring", label: "Sparring" },
];

function buildHref(q: string, type: SearchType): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type !== "all") params.set("type", type);
  const qs = params.toString();
  return `/search${qs ? `?${qs}` : ""}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q: rawQ, type: rawType } = await searchParams;
  const q = (rawQ ?? "").trim();
  const type: SearchType = VALID_TYPES.includes(rawType as SearchType) ? (rawType as SearchType) : "all";

  const actor = await getActor();

  let grouped: Awaited<ReturnType<typeof searchAll>> | null = null;
  let single: SearchResult[] | null = null;

  if (type === "all") {
    if (q) grouped = await searchAll(q, actor);
  } else if (type === "events") {
    single = await searchEvents(q, 20);
  } else if (type === "fighters") {
    single = await searchFighters(q, 20);
  } else if (type === "clubs") {
    single = await searchClubs(q, 20);
  } else {
    single = await searchSparring(q, actor?.clubIds ?? [], 20);
  }

  const groupedTotal = grouped
    ? grouped.events.length + grouped.fighters.length + grouped.clubs.length + grouped.sparring.length
    : 0;
  const showBrowse = type === "all" && !q;
  const showNoResults = q && ((grouped && groupedTotal === 0) || (single && single.length === 0));

  return (
    <div className="space-y-5 pt-2">
      <BackButton fallbackHref="/" />

      <SearchInput initialQuery={q} type={type} />

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={buildHref(q, f.key)}
            className={[
              "shrink-0 rounded-pill px-4 py-2 text-sm font-medium border whitespace-nowrap",
              type === f.key ? "bg-signal text-onsignal border-signal" : "border-white/15 text-mute",
            ].join(" ")}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {showBrowse && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Browse</p>
          <div className="grid grid-cols-2 gap-2">
            {FILTERS.filter((f) => f.key !== "all").map((f) => (
              <Link
                key={f.key}
                href={buildHref("", f.key)}
                className="rounded-card bg-panel border border-white/10 p-4 text-sm font-medium"
              >
                {f.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {showNoResults && (
        <div className="text-center py-10 space-y-1">
          <p className="text-sm font-medium">No results for &ldquo;{q}&rdquo;</p>
          <p className="text-xs text-mute">Try a different name, city or weight class.</p>
        </div>
      )}

      {grouped && (
        <>
          <ResultSection title="Boxers" items={grouped.fighters} seeAllHref={buildHref(q, "fighters")} />
          <ResultSection title="Events" items={grouped.events} seeAllHref={buildHref(q, "events")} />
          <ResultSection title="Clubs" items={grouped.clubs} seeAllHref={buildHref(q, "clubs")} />
          <ResultSection title="Sparring" items={grouped.sparring} seeAllHref={buildHref(q, "sparring")} />
        </>
      )}

      {single && single.length > 0 && (
        <div className="space-y-2">
          {single.map((r) => (
            <SearchResultRow key={`${r.kind}-${r.id}`} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultSection({ title, items, seeAllHref }: { title: string; items: SearchResult[]; seeAllHref: string }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">{title}</p>
        {items.length >= 4 && (
          <Link href={seeAllHref} className="text-xs text-signal font-semibold">
            See all →
          </Link>
        )}
      </div>
      <div className="space-y-2">
        {items.slice(0, 4).map((r) => (
          <SearchResultRow key={`${r.kind}-${r.id}`} result={r} />
        ))}
      </div>
    </section>
  );
}
