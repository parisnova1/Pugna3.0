import Link from "next/link";
import { formatEventDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import type { EventStatus } from "@prisma/client";

export type EventPreview = {
  slug: string | null;
  name: string;
  city: string | null;
  venue: string | null;
  date: Date;
  startTime: Date | null;
  status: EventStatus;
};

const STATUS_LABEL: Partial<Record<EventStatus, string>> = {
  LIVE: "LIVE",
  INTERMISSION: "INTERMISSION",
  PUBLISHED: "UPCOMING",
  FINISHED: "FINISHED",
  CANCELLED: "CANCELLED",
};

export function EventPreviewCard({
  event,
  coverUrl,
  checkedInCount,
}: {
  event: EventPreview;
  coverUrl?: string | null;
  checkedInCount?: number;
}) {
  if (!event.slug) return null;
  const isLive = event.status === "LIVE" || event.status === "INTERMISSION";

  const pill = (
    <Badge live={isLive} tone={isLive ? "signal" : "neutral"}>
      {STATUS_LABEL[event.status] ?? event.status}
    </Badge>
  );

  const checkInBadge =
    checkedInCount && checkedInCount > 0 ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-signal">
        <span className="w-1.5 h-1.5 rounded-full bg-signal" />
        {checkedInCount} checked in
      </span>
    ) : null;

  if (coverUrl) {
    return (
      <Link
        href={`/e/${event.slug}`}
        className="relative block rounded-card overflow-hidden aspect-[16/10] hover:opacity-95 transition-opacity"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <div className="absolute inset-0 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            {pill}
            <span className="text-xs text-white/80 tabular">{formatEventDateTime(event.date, event.startTime)}</span>
          </div>
          <div>
            <h3 className="font-semibold text-white">{event.name}</h3>
            <div className="flex items-center justify-between mt-0.5">
              {(event.venue || event.city) && (
                <p className="text-sm text-white/70">{[event.venue, event.city].filter(Boolean).join(" · ")}</p>
              )}
              {checkInBadge}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/e/${event.slug}`}
      className="block rounded-card bg-panel border border-white/10 p-4 hover:border-white/20 transition-colors"
    >
      <div className="flex items-center justify-between">
        {pill}
        <span className="text-xs text-mute tabular">{formatEventDateTime(event.date, event.startTime)}</span>
      </div>
      <h3 className="mt-2 font-semibold text-ink">{event.name}</h3>
      <div className="flex items-center justify-between mt-0.5">
        {(event.venue || event.city) && (
          <p className="text-sm text-mute">{[event.venue, event.city].filter(Boolean).join(" · ")}</p>
        )}
        {checkInBadge}
      </div>
    </Link>
  );
}
