import Link from "next/link";
import { formatEventDate } from "@/lib/format";

export type ClubEventItem = {
  id: string;
  slug: string | null;
  name: string;
  date: Date;
  venue: string | null;
  city: string | null;
  coverUrl: string | null;
  statusLabel: string;
  nominatedCount: number;
  isOrganizing: boolean;
};

/** One event card used across Club Home / Club Events — poster, name, date,
 * location, this club's participation status, and its nominated-fighter
 * count. "View Event" goes to the public page when published, or into the
 * existing host workflow when this club organizes it and it isn't public
 * yet — never a separate club-scoped event page. */
export function ClubEventListItem({ event }: { event: ClubEventItem }) {
  const href = event.slug ? `/e/${event.slug}` : event.isOrganizing ? `/host/events/${event.id}` : null;
  const locationLabel = [event.venue, event.city].filter(Boolean).join(" · ");

  const content = (
    <div className="relative rounded-card bg-panel border border-white/10 overflow-hidden p-4 hover:border-white/20 transition-colors">
      {event.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.coverUrl}
          alt=""
          className="absolute inset-y-0 right-0 w-[58%] h-full object-cover pointer-events-none opacity-55"
          style={{ objectPosition: "center right", maskImage: "linear-gradient(to right, transparent 0%, black 28%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 28%)" }}
        />
      )}
      <div className={`relative flex items-center justify-between gap-2 ${event.coverUrl ? "max-w-[58%]" : ""}`}>
        <span className="text-[11px] font-semibold rounded-pill border border-white/15 text-mute px-2 py-0.5">{event.statusLabel}</span>
        <span className="text-xs text-mute tabular shrink-0">{formatEventDate(event.date)}</span>
      </div>
      <h3 className={`relative mt-2 font-semibold text-ink truncate ${event.coverUrl ? "max-w-[58%]" : ""}`}>{event.name}</h3>
      <div className={`relative flex items-center justify-between mt-0.5 gap-2 ${event.coverUrl ? "max-w-[58%]" : ""}`}>
        {locationLabel && <p className="text-sm text-mute truncate min-w-0">{locationLabel}</p>}
        <span className="text-xs text-mute shrink-0">
          {event.nominatedCount} boxer{event.nominatedCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
