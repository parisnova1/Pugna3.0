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
    <Badge live={isLive} tone={isLive ? "live" : "neutral"}>
      {STATUS_LABEL[event.status] ?? event.status}
    </Badge>
  );

  const checkInBadge =
    checkedInCount && checkedInCount > 0 ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-live">
        <span className="w-1.5 h-1.5 rounded-full bg-live" />
        {checkedInCount} checked in
      </span>
    ) : null;

  return (
    <Link
      href={`/e/${event.slug}`}
      className="relative block rounded-card bg-panel border border-white/10 overflow-hidden p-4 hover:border-white/20 transition-colors"
    >
      {coverUrl && (
        // Right-weighted poster bleed, not a full-card photo: pinned to the right ~58%
        // and masked so it fades into the panel on the left, keeping the title/venue
        // column on a plain dark background instead of overlaid on top of a photo.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          className="absolute inset-y-0 right-0 w-[58%] h-full object-cover pointer-events-none"
          style={{
            objectPosition: "center right",
            maskImage: "linear-gradient(to right, transparent 0%, black 28%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 28%)",
            opacity: isLive ? 0.7 : 0.55,
          }}
        />
      )}
      <div className="relative max-w-[58%] flex items-center justify-between">
        {pill}
        <span className="text-xs text-mute tabular">{formatEventDateTime(event.date, event.startTime)}</span>
      </div>
      <h3 className="relative max-w-[58%] mt-2 font-semibold text-ink truncate">{event.name}</h3>
      <div className="relative max-w-[58%] flex items-center justify-between mt-0.5">
        {(event.venue || event.city) && (
          <p className="text-sm text-mute truncate">{[event.venue, event.city].filter(Boolean).join(" · ")}</p>
        )}
        {checkInBadge}
      </div>
    </Link>
  );
}
