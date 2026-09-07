import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EventPreviewCard } from "@/components/event/EventPreviewCard";

export default async function ClubProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const club = await prisma.club.findUnique({
    where: { id },
    include: {
      roster: { take: 8 },
      organizedEvents: {
        where: { status: { in: ["PUBLISHED", "LIVE", "INTERMISSION"] } },
        orderBy: { date: "asc" },
        take: 3,
      },
    },
  });

  if (!club) notFound();

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h1 className="text-2xl font-semibold">{club.name}</h1>
        <p className="text-mute text-sm mt-1">{club.city ?? "—"}</p>
      </div>

      {club.organizedEvents.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Upcoming</p>
          {club.organizedEvents.map((event) => (
            <EventPreviewCard key={event.id} event={event} />
          ))}
        </section>
      )}

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Roster</p>
        {club.roster.length === 0 ? (
          <p className="text-sm text-mute">No fighters listed yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {club.roster.map((fighter) => (
              <Link
                key={fighter.id}
                href={`/fighters/${fighter.id}`}
                className="rounded-card bg-panel border border-white/10 p-3"
              >
                <p className="text-sm font-medium">{fighter.displayName}</p>
                <p className="text-xs text-mute">{fighter.weightClass ?? "—"}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
