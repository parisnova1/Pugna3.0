import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { createEvent } from "@/lib/actions/event";
import { formatEventDate } from "@/lib/format";

export default async function HostHomePage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/host");
  if (actor.activeHat !== "ORGANIZER") {
    return (
      <div className="pt-10 text-center space-y-4">
        <p className="text-mute text-sm">Switch to your Organizer hat to host events.</p>
        <Link href="/account" className="inline-block rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm">
          Go to Account
        </Link>
      </div>
    );
  }

  const events = await prisma.event.findMany({
    where: { hostMembers: { some: { userId: actor.userId } } },
    orderBy: { date: "asc" },
    take: 10,
  });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const tonight = events.find(
    (e) => e.date >= startOfDay && e.date < endOfDay && ["PUBLISHED", "LIVE", "INTERMISSION"].includes(e.status),
  );

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">Host</h1>

      {tonight ? (
        <div className="rounded-card bg-panel border border-signal/30 p-5 space-y-3">
          <p className="text-xs font-semibold text-signal uppercase tracking-wide">Tonight</p>
          <p className="font-semibold">{tonight.name}</p>
          <p className="text-sm text-mute">{tonight.venue ?? tonight.city}</p>
          <div className="flex gap-2 pt-1">
            <Link
              href={`/host/events/${tonight.id}/live`}
              className="rounded-pill bg-signal text-onsignal font-semibold px-4 py-2 text-sm"
            >
              Live console
            </Link>
            <Link
              href={`/host/events/${tonight.id}`}
              className="rounded-pill border border-white/20 text-ink font-semibold px-4 py-2 text-sm"
            >
              Open event
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-card bg-panel border border-white/10 p-5 text-center">
          <p className="text-sm text-mute">No night tonight.</p>
        </div>
      )}

      <form
        action={async () => {
          "use server";
          const result = await createEvent();
          if (result.ok) redirect(`/host/events/${result.eventId}/build`);
        }}
      >
        <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3">
          + Create event
        </button>
      </form>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Your events</p>
        {events.length === 0 ? (
          <p className="text-sm text-mute">Nothing yet.</p>
        ) : (
          events.map((event) => (
            <Link
              key={event.id}
              href={event.status === "DRAFT" || event.status === "READY" ? `/host/events/${event.id}/build` : `/host/events/${event.id}`}
              className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{event.name}</p>
                <p className="text-xs text-mute mt-0.5">{formatEventDate(event.date)}</p>
              </div>
              <span className="text-xs text-mute">{event.status}</span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
