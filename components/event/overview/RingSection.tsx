import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { StickyLiveBar } from "./StickyLiveBar";
import type { Projection } from "@/lib/projection";
import type { EventCardData } from "@/lib/event-query";

type EventBout = EventCardData["event"]["bouts"][number];
type EventRing = EventCardData["event"]["rings"][number];

export function RingSection({
  slug,
  ring,
  projection,
  stickyLabel,
}: {
  slug: string;
  ring: EventRing;
  projection: Projection<EventBout>;
  stickyLabel: string | null;
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
    <Link href={`/e/${slug}/ring/${ring.id}`} className="block rounded-card bg-panel border border-white/10 p-4">
      <div className="flex items-center justify-between">
        <Badge live={projection.nowLabel === "LIVE"} tone={projection.nowLabel === "LIVE" ? "signal" : "neutral"}>
          {pillText}
        </Badge>
      </div>
      {projection.now ? (
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
