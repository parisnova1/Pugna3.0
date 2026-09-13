import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { WatchArea } from "@/components/live/WatchArea";
import { StickyLiveBar } from "./StickyLiveBar";
import { formatTime } from "@/lib/format";
import type { Projection } from "@/lib/projection";
import type { EventCardData } from "@/lib/event-query";

type EventBout = EventCardData["event"]["bouts"][number];
type EventRing = EventCardData["event"]["rings"][number];

export function RingSection({
  slug,
  ring,
  projection,
  stickyLabel,
  eventStreamUrl,
}: {
  slug: string;
  ring: EventRing;
  projection: Projection<EventBout>;
  stickyLabel: string | null;
  eventStreamUrl: string | null;
}) {
  const pillText =
    projection.nowLabel === "LIVE"
      ? "Live"
      : projection.nowLabel === "DELAYED"
        ? "Delayed"
        : projection.nowLabel === "BREAK"
          ? "On break"
          : projection.nowLabel === "UP_NEXT"
            ? "Up next"
            : "No bout";

  const nowCard = (
    <div className="rounded-card bg-panel border border-white/10 p-4">
      <Link href={`/e/${slug}/ring/${ring.id}`} className="block">
        <div className="flex items-center justify-between">
          <Badge live={projection.nowLabel === "LIVE"} tone={projection.nowLabel === "LIVE" ? "live" : "neutral"}>
            {pillText}
          </Badge>
        </div>
        {projection.nowLabel === "BREAK" ? (
          <p className="text-sm text-mute mt-2">
            {ring.breakUntil ? `Resuming at ${formatTime(ring.breakUntil)}` : "Resuming shortly"}
            {ring.breakReason ? ` · ${ring.breakReason}` : ""}
          </p>
        ) : projection.now ? (
          <>
            <p className="text-xs text-mute mt-2">{projection.now.weightClass}</p>
            <p className="text-lg font-semibold mt-0.5">
              {projection.now.fighterA?.displayName ?? "TBD"} <span className="text-mute font-normal">vs</span>{" "}
              {projection.now.fighterB?.displayName ?? "TBD"}
            </p>
          </>
        ) : (
          <p className="text-sm text-mute mt-2">No bout in progress.</p>
        )}
      </Link>
      {projection.now && (
        <div className="mt-2">
          <WatchArea url={projection.now.streamUrl ?? eventStreamUrl} status={projection.now.status} size="compact" />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-mute uppercase tracking-wide">{ring.name ?? `Ring ${ring.number}`}</p>
      {stickyLabel ? <StickyLiveBar label={stickyLabel}>{nowCard}</StickyLiveBar> : nowCard}
      {projection.next && (
        <Link
          href={`/e/${slug}/bout/${projection.next.id}`}
          className="flex items-center justify-between rounded-card border border-white/10 px-4 py-2.5 text-sm"
        >
          <span className="text-mute">
            NEXT · {projection.next.weightClass}
          </span>
          <span>
            {projection.next.fighterA?.displayName ?? "TBD"} <span className="text-mute">vs</span>{" "}
            {projection.next.fighterB?.displayName ?? "TBD"}
          </span>
        </Link>
      )}
    </div>
  );
}
