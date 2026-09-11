import Link from "next/link";
import { formatTime } from "@/lib/format";
import { boutStatusLabel } from "@/lib/bout-status";
import { WatchArea } from "@/components/live/WatchArea";
import type { EventCardData } from "@/lib/event-query";

type EventBout = EventCardData["event"]["bouts"][number];
type EventRing = EventCardData["event"]["rings"][number];

export function ScheduleList({
  slug,
  bouts,
  weightClasses,
  rings,
  nextBoutIds,
  eventStreamUrl,
}: {
  slug: string;
  bouts: EventBout[];
  weightClasses: string[];
  rings: EventRing[];
  nextBoutIds: Set<string>;
  eventStreamUrl: string | null;
}) {
  if (bouts.length === 0) {
    return <p className="text-sm text-mute py-6 text-center">No bouts scheduled for this day.</p>;
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
              const isLive = bout.status === "IN_PROGRESS";
              const isFinal = bout.status === "FINAL";
              const label = boutStatusLabel(bout.status, nextBoutIds.has(bout.id), bout.delayMinutes);

              return (
                <div
                  key={bout.id}
                  className={[
                    "rounded-card border px-4 py-3",
                    isLive ? "border-signal/40 bg-signal/5" : "border-white/10 bg-panel",
                  ].join(" ")}
                >
                  <Link href={`/e/${slug}/bout/${bout.id}`} className="block">
                    <div className="flex items-center justify-between text-[11px] text-mute">
                      <span>
                        {ring?.name ?? "Ring"}
                        {bout.scheduledTime ? ` · ${formatTime(bout.scheduledTime)}` : ""}
                      </span>
                      <span className={isLive || label.startsWith("NEXT") ? "text-signal font-semibold" : ""}>{label}</span>
                    </div>
                    <p className="text-sm font-medium mt-1">
                      {bout.fighterA?.displayName ?? "TBD"} <span className="text-mute font-normal">vs</span>{" "}
                      {bout.fighterB?.displayName ?? "TBD"}
                    </p>
                    {isFinal && bout.result && (
                      <p className="text-xs text-mute mt-0.5">
                        {bout.result.method}
                        {bout.result.round ? ` · Round ${bout.result.round}` : ""}
                      </p>
                    )}
                  </Link>
                  {isLive && (
                    <div className="mt-2">
                      <WatchArea url={bout.streamUrl ?? eventStreamUrl} status={bout.status} size="compact" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
