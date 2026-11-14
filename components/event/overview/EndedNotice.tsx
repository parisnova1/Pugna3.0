import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

/**
 * Shown at the top of an event that is over but was never marked finished by
 * its host. Says plainly that it has ended, points at the results when there
 * are any, and gives the visitor somewhere to go next instead of a live screen.
 */
export function EndedNotice({
  resultsCount,
  resultsHref,
  organizerName,
  organizerHref,
}: {
  resultsCount: number;
  resultsHref: string;
  organizerName: string | null;
  organizerHref: string | null;
}) {
  return (
    <section aria-label="Event ended" className="mt-4 rounded-card bg-panel border border-white/10 p-5 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">This event has ended.</p>
        <p className="text-sm text-mute">
          {resultsCount > 0
            ? `${resultsCount} ${resultsCount === 1 ? "result was" : "results were"} recorded.`
            : "No results were recorded for this event."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {resultsCount > 0 && (
          <Link href={resultsHref} className={buttonClass({ size: "xs", text: "sm", className: "inline-block px-4" })}>
            View results
          </Link>
        )}
        <Link
          href="/events"
          className={buttonClass({ variant: "outline", size: "xs", text: "sm", className: "inline-block px-4" })}
        >
          Upcoming events
        </Link>
        {organizerName && organizerHref && (
          <Link
            href={organizerHref}
            className={buttonClass({ variant: "outline", size: "xs", text: "sm", className: "inline-block px-4" })}
          >
            More from {organizerName}
          </Link>
        )}
      </div>
    </section>
  );
}
