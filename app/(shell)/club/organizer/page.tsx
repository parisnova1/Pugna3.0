import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { createEventFromClub } from "@/lib/actions/event";
import { formatEventDate } from "@/lib/format";
import { ClubNav } from "@/components/club/ClubNav";
import type { EventStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "Draft",
  READY: "Published",
  PUBLISHED: "Published",
  LIVE: "Live",
  INTERMISSION: "Live",
  FINISHED: "Completed",
  ARCHIVED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_ORDER = ["Live", "Published", "Draft", "Completed", "Cancelled"];

export default async function ClubOrganizerPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club/organizer");

  const { club: requestedClubId } = await searchParams;
  const clubId = requestedClubId && actor.clubIds.includes(requestedClubId) ? requestedClubId : actor.clubIds[0];
  if (!clubId) redirect("/club");

  const hosting = await prisma.event.findMany({ where: { organizingClubId: clubId }, orderBy: { date: "desc" }, take: 30 });

  const grouped = new Map<string, typeof hosting>();
  for (const event of hosting) {
    const label = STATUS_LABEL[event.status];
    grouped.set(label, [...(grouped.get(label) ?? []), event]);
  }

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">Organizer</h1>
      <ClubNav active="organizer" />

      <form
        action={async () => {
          "use server";
          await createEventFromClub(clubId);
        }}
      >
        <Button type="submit" size="lg" fullWidth>
          + Host an Event
        </Button>
      </form>

      <section className="space-y-4">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Your Events</p>
        {hosting.length === 0 ? (
          <EmptyState>Not hosting anything yet.</EmptyState>
        ) : (
          STATUS_ORDER.filter((label) => grouped.has(label)).map((label) => (
            <div key={label} className="space-y-2">
              <p className="text-xs text-mute font-medium">{label}</p>
              {grouped.get(label)!.map((event) => (
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
          ))
        )}
      </section>
    </div>
  );
}
