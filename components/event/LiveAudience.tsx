import Link from "next/link";

/** Event-level entry point into the venue check-in / crowd system already
 * built on the Bout page (EventCheckIn model, CrowdStrip composer) — this
 * section never invents its own comment feed, just surfaces real check-in
 * state and links into the real one. */
export function LiveAudience({
  slug,
  checkedInCount,
  viewerCheckedIn,
  liveBoutId,
}: {
  slug: string;
  checkedInCount: number;
  viewerCheckedIn: boolean;
  liveBoutId: string | null;
}) {
  return (
    <div className="rounded-card bg-panel border border-white/10 p-5 space-y-3">
      <p className="text-xs font-semibold text-mute uppercase tracking-wide">Live Audience</p>

      {checkedInCount > 0 && (
        <p className="text-sm text-mute">
          💬 {checkedInCount} {checkedInCount === 1 ? "person" : "people"} checked in
        </p>
      )}

      {viewerCheckedIn ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-signal">✓ You&apos;re checked in</p>
          {liveBoutId ? (
            <Link
              href={`/e/${slug}/bout/${liveBoutId}`}
              className="inline-block rounded-pill bg-signal text-onsignal text-sm font-semibold px-4 py-2"
            >
              Comment
            </Link>
          ) : (
            <p className="text-sm text-mute">You&apos;re part of the live audience.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-mute">You&apos;re watching from home.</p>
          <p className="text-sm text-mute">Check in at the venue to join the live audience.</p>
          <Link
            href={`/e/${slug}/check-in`}
            className="inline-block rounded-pill border border-white/20 text-ink text-sm font-semibold px-4 py-2"
          >
            Check in
          </Link>
        </div>
      )}
    </div>
  );
}
