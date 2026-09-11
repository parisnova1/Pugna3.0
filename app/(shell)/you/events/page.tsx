import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";
import { BackButton } from "@/components/event/ContextBar";
import { Badge } from "@/components/ui/Badge";

export default async function FollowedEventsPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/you/events");

  const follows = await prisma.follow.findMany({
    where: { userId: actor.userId },
    include: { event: true },
    orderBy: { event: { date: "asc" } },
  });

  return (
    <div className="space-y-4 pt-2">
      <BackButton />
      <h1 className="text-2xl font-semibold">Followed events</h1>

      {follows.length === 0 ? (
        <div className="text-center py-10 space-y-1">
          <p className="text-sm font-medium">No followed events yet.</p>
          <p className="text-xs text-mute">Follow an event to see it here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {follows.map(({ event }) => (
            <Link
              key={event.id}
              href={event.slug ? `/e/${event.slug}` : "#"}
              className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{event.name}</p>
                <p className="text-xs text-mute mt-0.5">{formatEventDate(event.date)}</p>
              </div>
              {event.status === "LIVE" || event.status === "INTERMISSION" ? (
                <Badge live tone="signal">
                  Live
                </Badge>
              ) : (
                <span className="text-mute">›</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
