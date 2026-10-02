import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function LiveChooserPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/host/events/live");

  const live = await prisma.event.findFirst({
    where: { hostMembers: { some: { userId: actor.userId } }, status: { in: ["LIVE", "INTERMISSION"] } },
    orderBy: { date: "asc" },
  });

  if (live) redirect(`/host/events/${live.id}/live`);

  const upcoming = await prisma.event.findMany({
    where: { hostMembers: { some: { userId: actor.userId } }, status: "PUBLISHED" },
    orderBy: { date: "asc" },
    take: 5,
  });

  return (
    <div className="pt-10 text-center space-y-4">
      <EmptyState>No live event right now.</EmptyState>
      {upcoming.length > 0 && (
        <div className="space-y-2 text-left">
          {upcoming.map((event) => (
            <Link
              key={event.id}
              href={`/host/events/${event.id}`}
              className="block rounded-card bg-panel border border-white/10 px-4 py-3 text-sm"
            >
              {event.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
