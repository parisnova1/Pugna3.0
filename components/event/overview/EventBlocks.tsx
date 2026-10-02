import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { FollowButton } from "@/components/event/FollowButton";
import { ShareSheet } from "@/components/event/ShareSheet";
import { formatTime } from "@/lib/format";
import type { eventStatusPillFor } from "@/lib/bout-status";

/**
 * The hero (cover, status, title, where/when) and the follow/share row at the
 * top of a public event page. Shared by the single-ring and multi-day layouts,
 * which differ only in the date text and whether the venue shows a map pin.
 */
export function EventHeader({
  coverUrl,
  pill,
  followCount,
  name,
  venueLabel,
  dateText,
  showPin = false,
  eventId,
  slug,
  code,
  isGuest,
  following,
  cancelReason,
}: {
  coverUrl: string | null;
  pill: ReturnType<typeof eventStatusPillFor>;
  followCount: number;
  name: string;
  venueLabel: string;
  dateText: string;
  showPin?: boolean;
  eventId: string;
  slug: string;
  code: string | null;
  isGuest: boolean;
  following: boolean;
  cancelReason: string | null;
}) {
  return (
    <div id="overview" className="scroll-mt-24">
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="w-full aspect-video object-cover rounded-card mb-4" />
      )}

      <div className="space-y-1.5 mb-4">
        {pill && (
          <div className="flex items-center gap-2">
            <Badge live={pill.live} tone={pill.live ? "live" : "neutral"}>
              {pill.text}
            </Badge>
            {followCount > 0 && (
              <span className="text-[11px] text-mute tabular">
                {new Intl.NumberFormat("en-US").format(followCount)} watching
              </span>
            )}
          </div>
        )}
        <h1 className="text-2xl font-semibold">{name}</h1>
        {showPin ? (
          <p className="text-mute text-sm flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
              <path d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            {venueLabel}
          </p>
        ) : (
          <p className="text-mute text-sm">{venueLabel}</p>
        )}
        <p className="text-mute text-sm">{dateText}</p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <FollowButton eventId={eventId} slug={slug} isGuest={isGuest} following={following} />
        <ShareSheet code={code} name={name} />
        <Link href="/account" aria-label="Account" className="rounded-full border border-white/15 p-2.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
          </svg>
        </Link>
        {cancelReason && <p className="text-sm text-error">Cancelled: {cancelReason}</p>}
      </div>
    </div>
  );
}

export function EventInfoCard({
  hasVenue,
  venueLabel,
  dateText,
  startTime,
  directionsHref,
}: {
  hasVenue: boolean;
  venueLabel: string;
  dateText: string;
  startTime: Date | null;
  directionsHref: string | null;
}) {
  return (
    <div className="rounded-card bg-panel border border-white/10 p-5 space-y-3">
      <p className="text-xs font-semibold text-mute uppercase tracking-wide">Event Info</p>
      {hasVenue && (
        <div>
          <p className="text-xs text-mute">Venue</p>
          <p className="text-sm font-medium">{venueLabel}</p>
        </div>
      )}
      <div>
        <p className="text-xs text-mute">Date</p>
        <p className="text-sm font-medium">{dateText}</p>
      </div>
      {startTime && (
        <div>
          <p className="text-xs text-mute">Start</p>
          <p className="text-sm font-medium">{formatTime(startTime)}</p>
        </div>
      )}
      {directionsHref && (
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ variant: "outline", size: "xs", text: "sm", weight: "medium", className: "inline-block px-4" })}
        >
          Directions
        </a>
      )}
    </div>
  );
}

export function OrganizerCard({ name, href }: { name: string; href: string | null }) {
  return (
    <div className="rounded-card bg-panel border border-white/10 p-5 space-y-2">
      <p className="text-xs font-semibold text-mute uppercase tracking-wide">Organized by</p>
      {href ? (
        <Link href={href} className="text-sm font-semibold text-signal">
          {name} →
        </Link>
      ) : (
        <p className="text-sm font-semibold">{name}</p>
      )}
    </div>
  );
}
