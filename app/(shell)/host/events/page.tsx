import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";

export default async function HostEventsPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/host/events");

  const events = await prisma.event.findMany({
    where: { hostMembers: { some: { userId: actor.userId } } },
    orderBy: { date: "desc" },
  });

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-2xl font-semibold">Your events</h1>
      {events.length === 0 ? (
        <p className="text-mute text-sm">No events yet.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
