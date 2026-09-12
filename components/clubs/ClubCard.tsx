import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ClubFollowButton } from "@/components/clubs/ClubFollowButton";

export type ClubCardData = {
  id: string;
  name: string;
  city: string | null;
  sport: string;
  isVerified: boolean;
  coverUrl: string | null;
  rosterCount: number;
  coachCount?: number;
  following?: boolean;
};

/** The one card used by both Featured Clubs and All Clubs — same entity,
 * same information model, so the two sections never drift apart. Renders
 * only fields that actually exist; never fabricates a stat.
 *
 * Not a whole-card `<Link>` (unlike most cards in this app) because it also
 * needs a real `<button>` for Follow — nesting a button inside an anchor is
 * invalid HTML and would fire both actions on one tap. The name/meta block
 * stays its own full-width `<Link>` for navigation; Follow gets its own row
 * at the bottom so it never squeezes the name/badge column. */
export function ClubCard({ club, isGuest = true }: { club: ClubCardData; isGuest?: boolean }) {
  const metaLine = [club.city, club.sport].filter(Boolean).join(" · ");

  const statParts: string[] = [];
  if (club.rosterCount > 0) statParts.push(`${club.rosterCount} Boxer${club.rosterCount === 1 ? "" : "s"}`);
  if (club.coachCount && club.coachCount > 0) statParts.push(`${club.coachCount} Coach${club.coachCount === 1 ? "" : "es"}`);

  return (
    <div className="rounded-card bg-panel border border-white/10 p-4 hover:border-white/20 transition-colors">
      <Link href={`/clubs/${club.id}`} className="flex gap-3 items-start">
        <ClubAvatar name={club.name} coverUrl={club.coverUrl} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink truncate">{club.name}</p>
          {metaLine && <p className="text-xs text-mute mt-0.5">{metaLine}</p>}
          {club.isVerified && (
            <div className="mt-1.5">
              <Badge tone="success">✓ PUGNA Verified</Badge>
            </div>
          )}
          {statParts.length > 0 && <p className="text-xs text-mute mt-1.5">{statParts.join(" · ")}</p>}
        </div>
      </Link>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
        <Link href={`/clubs/${club.id}`} className="text-xs font-medium text-signal">
          View Club →
        </Link>
        <ClubFollowButton clubId={club.id} isGuest={isGuest} following={Boolean(club.following)} />
      </div>
    </div>
  );
}

export function ClubAvatar({ name, coverUrl, size = 56 }: { name: string; coverUrl: string | null; size?: number }) {
  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt=""
        loading="lazy"
        style={{ width: size, height: size }}
        className="shrink-0 rounded-card object-cover border border-white/10"
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      style={{ width: size, height: size }}
      className="shrink-0 rounded-card bg-signal/10 border border-signal/20 flex items-center justify-center"
    >
      <span className="font-bold text-signal" style={{ fontSize: size * 0.4 }}>
        {initial}
      </span>
    </div>
  );
}
