import Link from "next/link";
import { formatTime } from "@/lib/format";
import type { EventCardData } from "@/lib/event-query";

type EventBout = EventCardData["event"]["bouts"][number];
type EventRing = EventCardData["event"]["rings"][number];

export function ResultsList({
  slug,
  bouts,
  weightClasses,
  rings,
}: {
  slug: string;
  bouts: EventBout[];
  weightClasses: string[];
  rings: EventRing[];
}) {
  if (bouts.length === 0) {
    return (
      <div className="py-10 text-center space-y-1">
        <p className="text-sm font-medium">No results yet.</p>
        <p className="text-xs text-mute">Completed fights will appear here once bouts are finished.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {weightClasses.map((w) => {
        const group = bouts.filter((b) => b.weightClass === w).sort((a, b) => a.number - b.number);
        if (group.length === 0) return null;

        return (
          <div key={w} className="space-y-2">
            <p className="text-xs font-semibold text-mute uppercase tracking-wide">{w}</p>
            {group.map((bout) => {
              const ring = rings.find((r) => r.id === bout.ringId);
              const aWon = bout.result?.winnerId === bout.fighterAId;
              const bWon = bout.result?.winnerId === bout.fighterBId;

              return (
                <Link
                  key={bout.id}
                  href={`/e/${slug}/bout/${bout.id}`}
                  className="block rounded-card bg-panel border border-white/10 px-4 py-3 hover:border-white/20 transition-colors"
                >
                  <p className="text-[11px] text-mute">Bout {bout.number}</p>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-sm flex items-center justify-between gap-2">
                      <span className={aWon ? "font-semibold text-success" : "font-medium"}>{bout.fighterA?.displayName ?? "TBD"}</span>
                      {aWon && <span className="shrink-0">🏆</span>}
                    </p>
                    <p className="text-sm flex items-center justify-between gap-2">
                      <span className={bWon ? "font-semibold text-success" : "font-medium"}>{bout.fighterB?.displayName ?? "TBD"}</span>
                      {bWon && <span className="shrink-0">🏆</span>}
                    </p>
                  </div>
                  <p className="text-xs text-mute mt-1.5">
                    {bout.result?.method ?? "Result"}
                    {bout.result?.round ? ` · Round ${bout.result.round}` : ""}
                    {ring ? ` · ${ring.name ?? "Ring"}` : ""}
                    {bout.scheduledTime ? ` · ${formatTime(bout.scheduledTime)}` : ""}
                  </p>
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
