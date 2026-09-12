import Link from "next/link";

/**
 * "← Previous Fight / Next Fight →" through the event's official running
 * order (day, then bout number) — NOT fighter-specific. Distinct from
 * NextFightPanel, which tracks one fighter's next bout regardless of order.
 */
export function BoutSequenceNav({
  slug,
  previousBoutId,
  nextBoutId,
}: {
  slug: string;
  previousBoutId: string | null;
  nextBoutId: string | null;
}) {
  if (!previousBoutId && !nextBoutId) return null;

  return (
    <div className="flex items-center justify-between text-sm">
      {previousBoutId ? (
        <Link href={`/e/${slug}/bout/${previousBoutId}`} className="text-mute font-medium">
          ← Previous Fight
        </Link>
      ) : (
        <span />
      )}
      {nextBoutId ? (
        <Link href={`/e/${slug}/bout/${nextBoutId}`} className="text-mute font-medium">
          Next Fight →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
