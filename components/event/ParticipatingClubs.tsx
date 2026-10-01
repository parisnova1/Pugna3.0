import Link from "next/link";

export type ParticipatingClub = { clubId: string; clubName: string; nominatedCount: number };

/** Non-sensitive aggregate info (club name + how many boxers they've submitted)
 * — same data already shown host-side on the entries page, just surfaced
 * publicly here since "who's participating" isn't private. */
export function ParticipatingClubs({ clubs }: { clubs: ParticipatingClub[] }) {
  if (clubs.length === 0) return null;

  return (
    <div className="rounded-card bg-panel border border-white/10 p-5 space-y-2">
      <p className="text-xs font-semibold text-mute uppercase tracking-wide">Participating Clubs</p>
      <div className="space-y-1.5">
        {clubs.map((c) => (
          <Link key={c.clubId} href={`/clubs/${c.clubId}`} className="flex items-center justify-between text-sm">
            <span className="font-medium truncate pr-2">{c.clubName}</span>
            <span className="text-mute text-xs shrink-0">
              {c.nominatedCount} boxer{c.nominatedCount === 1 ? "" : "s"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
