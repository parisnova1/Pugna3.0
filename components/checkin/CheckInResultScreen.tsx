import Link from "next/link";
import type { CheckInAttempt } from "@/lib/actions/eventCheckin";
import { buttonClass } from "@/components/ui/Button";

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

  if (result.status === "RATE_LIMITED") {
    return (
      <Screen title="Check-in">
        <p className="text-mute text-sm">Too many attempts. Try again in a few minutes.</p>
      </Screen>
    );
  }

  if (result.status === "INVALID_CODE") {
    return (
      <Screen title="Check-in">
        <p className="text-mute text-sm">This check-in code isn&apos;t valid.</p>
        <div className="flex justify-center gap-2 pt-2">
          <Link href="/scan" className={buttonClass({ text: "sm", className: "px-5" })}>
            Scan QR
          </Link>
          <Link href="/" className={buttonClass({ variant: "outline", text: "sm", className: "px-5" })}>
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
      <p className="text-success text-sm font-semibold">
        {result.alreadyCheckedIn ? "You're already in the room." : "You're in the room."}
      </p>
      <div className="flex flex-col gap-2 pt-2">
        {result.eventSlug && (
          <Link
            href={result.liveBoutId ? `/e/${result.eventSlug}/bout/${result.liveBoutId}` : `/e/${result.eventSlug}`}
            className={buttonClass({ text: "sm", className: "px-5" })}
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
    <Link href={`/e/${slug}`} className={buttonClass({ text: "sm", className: "inline-block px-5" })}>
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
