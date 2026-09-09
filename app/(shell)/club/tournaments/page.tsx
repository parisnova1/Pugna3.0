import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { createEventFromClub } from "@/lib/actions/event";
import { formatEventDate } from "@/lib/format";

export default async function ClubTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club/tournaments");

  const { club: requestedClubId } = await searchParams;
  const clubId = requestedClubId && actor.clubIds.includes(requestedClubId) ? requestedClubId : actor.clubIds[0];
  if (!clubId) redirect("/club");

  const hosting = await prisma.event.findMany({ where: { organizingClubId: clubId }, orderBy: { date: "desc" }, take: 20 });

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tournaments</h1>
        <form
          action={async () => {
            "use server";
            await createEventFromClub(clubId);
          }}
        >
          <button type="submit" className="rounded-pill bg-signal text-onsignal px-4 py-2 text-sm font-semibold">
            + Create
          </button>
        </form>
      </div>

      {hosting.length === 0 ? (
        <p className="text-sm text-mute">Not hosting anything yet.</p>
      ) : (
        <div className="space-y-2">
          {hosting.map((e) => (
            <Link
              key={e.id}
              href={e.slug ? `/e/${e.slug}` : `/host/events/${e.id}`}
              className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
            >
              <p className="text-sm font-medium">{e.name}</p>
              <p className="text-xs text-mute">{formatEventDate(e.date)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
