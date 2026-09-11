import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { checkInViewer } from "@/lib/actions/eventCheckin";
import { CheckInResultScreen } from "@/components/checkin/CheckInResultScreen";

export default async function EventCheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string; go?: string }>;
}) {
  const { slug } = await params;
  const { code, go } = await searchParams;
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) notFound();

  const actor = await getActor();

  if (!actor) {
    return (
      <div className="min-h-screen mx-auto w-full max-w-md px-4 pt-16 text-center space-y-6">
        <div>
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Check-in</p>
          <h1 className="text-2xl font-semibold mt-1">{event.name}</h1>
        </div>
        <p className="text-mute text-sm">Check in at the event to join the crowd.</p>
        <Link
          href={`/account?returnTo=${encodeURIComponent(`/e/${slug}/check-in`)}`}
          className="inline-block rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm"
        >
          Sign in
        </Link>
      </div>
    );
  }

  // Entering a code (manual "Enter code" submit) attempts check-in directly.
  if (code) {
    const result = await checkInViewer({ code, source: "CODE" });
    return <CheckInResultScreen result={result} />;
  }

  const canCheckInNow = event.status === "LIVE" || event.status === "INTERMISSION";

  // The explicit "Check in now" button was tapped.
  if (go === "1" && canCheckInNow) {
    const result = await checkInViewer({ eventId: event.id, source: "CARD" });
    return <CheckInResultScreen result={result} />;
  }

  return (
    <div className="min-h-screen mx-auto w-full max-w-md px-4 pt-16 text-center space-y-6">
      <div>
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Check-in</p>
        <h1 className="text-2xl font-semibold mt-1">{event.name}</h1>
      </div>

      {canCheckInNow ? (
        <>
          <p className="text-mute text-sm">Check in at the event to join the crowd.</p>
          <form action={`/e/${slug}/check-in`} className="space-y-3">
            <input type="hidden" name="go" value="1" />
            <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3">
              Check in now
            </button>
          </form>
        </>
      ) : event.status === "PUBLISHED" ? (
        <p className="text-mute text-sm">Check-in opens when the event goes live.</p>
      ) : (
        <p className="text-mute text-sm">Check-in closed.</p>
      )}

      <div className="pt-4 space-y-3">
        <p className="text-xs text-mute">Scan the venue QR or enter the check-in code.</p>
        <div className="flex justify-center gap-2">
          <Link
            href="/scan?intent=checkin"
            className="rounded-pill border border-white/20 text-ink font-semibold px-5 py-3 text-sm"
          >
            Scan QR
          </Link>
        </div>
        <form action={`/e/${slug}/check-in`} className="flex gap-2 pt-1">
          <input
            name="code"
            placeholder="Enter code"
            className="flex-1 rounded-card bg-panel border border-white/10 px-4 py-2.5 text-sm text-center"
          />
          <button type="submit" className="rounded-pill border border-white/20 text-ink font-semibold px-4 text-sm">
            Enter code
          </button>
        </form>
      </div>

      <Link href={`/e/${slug}`} className="block text-sm text-mute underline pt-2">
        Open event
      </Link>
    </div>
  );
}
