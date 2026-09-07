import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { createClub, claimClub } from "@/lib/actions/club";
import { ActionForm } from "@/components/host/ActionForm";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

export default async function ClubHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club");

  const myClub = actor.adminClubIds.length > 0
    ? await prisma.club.findUnique({
        where: { id: actor.adminClubIds[0] },
        include: {
          _count: { select: { roster: true } },
          requests: { where: { status: { in: ["PENDING", "PARTIAL"] } } },
          organizedEvents: { where: { status: { in: ["PUBLISHED", "LIVE", "INTERMISSION"] } }, take: 3 },
        },
      })
    : null;

  if (myClub) {
    return (
      <div className="space-y-6 pt-2">
        <div>
          <h1 className="text-2xl font-semibold">{myClub.name}</h1>
          <p className="text-mute text-sm mt-1">{myClub.city ?? "—"} · {myClub._count.roster} fighters</p>
        </div>

        {myClub.requests.length > 0 && (
          <div className="rounded-card bg-panel border border-signal/30 p-4">
            <p className="text-sm font-medium">{myClub.requests.length} open request{myClub.requests.length > 1 ? "s" : ""}</p>
            <Link href="/club/events" className="text-xs text-signal mt-1 inline-block">
              Review
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link href="/club/roster" className="rounded-card bg-panel border border-white/10 p-4">
            <p className="font-semibold text-sm">Roster</p>
            <p className="text-xs text-mute mt-1">Manage fighters</p>
          </Link>
          <Link href="/club/events" className="rounded-card bg-panel border border-white/10 p-4">
            <p className="font-semibold text-sm">Events</p>
            <p className="text-xs text-mute mt-1">Hosting &amp; requests</p>
          </Link>
        </div>

        <Link
          href="/host"
          className="block text-center rounded-pill border border-white/20 text-ink font-semibold py-3"
        >
          Host an event
        </Link>
      </div>
    );
  }

  const { q } = await searchParams;
  const clubs = q
    ? await prisma.club.findMany({ where: { name: { contains: q, mode: "insensitive" } }, include: { admins: true }, take: 10 })
    : [];

  return (
    <div className="space-y-8 pt-2">
      <h1 className="text-2xl font-semibold">Club</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Create</h2>
        <ActionForm action={createClub} submitLabel="Create club" className="space-y-3">
          <input name="name" placeholder="Club name" required className={inputClass} />
          <input name="city" placeholder="City" className={inputClass} />
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Claim</h2>
        <form className="relative">
          <input name="q" defaultValue={q} placeholder="Search clubs" className={inputClass} />
        </form>
        {clubs.map((club) => (
          <div key={club.id} className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{club.name}</p>
              <p className="text-xs text-mute">{club.admins.length > 0 ? "Claimed" : "Unclaimed"}</p>
            </div>
            {club.admins.length === 0 && (
              <form
                action={async () => {
                  "use server";
                  await claimClub(club.id);
                }}
              >
                <button type="submit" className="rounded-pill border border-white/20 px-3 py-1.5 text-xs font-medium">
                  Claim
                </button>
              </form>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
