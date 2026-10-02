import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function HostResultsPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/host/results");

  const finished = await prisma.event.findMany({
    where: { hostMembers: { some: { userId: actor.userId } }, status: { in: ["FINISHED", "ARCHIVED"] } },
    orderBy: { date: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-2xl font-semibold">Results</h1>
      {finished.length === 0 ? (
        <EmptyState>No finished events yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {finished.map((event) => (
            <Link
              key={event.id}
              href={event.slug ? `/e/${event.slug}` : `/host/events/${event.id}`}
              className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
            >
              <p className="text-sm font-medium">{event.name}</p>
              <p className="text-xs text-mute">{formatEventDate(event.date)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
