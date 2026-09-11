import Link from "next/link";
import type { CheckInAttempt } from "@/lib/actions/eventCheckin";

/** Renders the outcome of a checkInViewer() attempt — shared by /in/:code
 * (auto-attempts on load) and /e/:slug/check-in (attempts on a button tap). */
export function CheckInResultScreen({ result }: { result: CheckInAttempt }) {
  if (result.status === "AUTH_REQUIRED") {
    return (
      <Screen title="Check-in">
        <p className="text-mute text-sm">Sign in required.</p>
      </Screen>
    );
  }

  if (result.status === "INVALID_CODE") {
    return (
      <Screen title="Check-in">
        <p className="text-mute text-sm">This check-in code isn&apos;t valid.</p>
        <div className="flex justify-center gap-2 pt-2">
          <Link href="/scan" className="rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm">
            Scan QR
          </Link>
          <Link href="/" className="rounded-pill border border-white/20 text-ink font-semibold px-5 py-3 text-sm">
            Discover
          </Link>
        </div>
      </Screen>
    );
  }

  if (result.status === "NOT_PUBLISHED") {
    return (
      <Screen title={result.eventName}>
        <p className="text-mute text-sm">This event isn&apos;t live yet.</p>
      </Screen>
    );
  }

  if (result.status === "NOT_LIVE_YET") {
    return (
      <Screen title={result.eventName}>
        <p className="text-mute text-sm">Check-in opens when the event goes live.</p>
        {result.eventSlug && <OpenEventLink slug={result.eventSlug} />}
      </Screen>
    );
  }

  if (result.status === "CLOSED") {
    return (
      <Screen title={result.eventName}>
        <p className="text-mute text-sm">Check-in closed.</p>
        {result.eventSlug && <OpenEventLink slug={result.eventSlug} />}
      </Screen>
    );
  }

  // OK
  return (
    <Screen title={result.eventName}>
      <p className="text-signal text-sm font-semibold">
        {result.alreadyCheckedIn ? "You're already in the room." : "You're in the room."}
      </p>
      <div className="flex flex-col gap-2 pt-2">
        {result.eventSlug && (
          <Link
            href={result.liveBoutId ? `/e/${result.eventSlug}/bout/${result.liveBoutId}` : `/e/${result.eventSlug}`}
            className="rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm"
          >
            Join the crowd
          </Link>
        )}
        {result.eventSlug && result.liveBoutId && <OpenEventLink slug={result.eventSlug} />}
      </div>
    </Screen>
  );
}

function OpenEventLink({ slug }: { slug: string }) {
  return (
    <Link href={`/e/${slug}`} className="inline-block rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm">
      Open event
    </Link>
  );
}

function Screen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen mx-auto w-full max-w-md px-4 pt-16 text-center space-y-4">
      <div>
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Check-in</p>
        <h1 className="text-2xl font-semibold mt-1">{title}</h1>
      </div>
      {children}
    </div>
  );
}
