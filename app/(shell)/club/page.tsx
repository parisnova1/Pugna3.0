import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { createClub, claimClub } from "@/lib/actions/club";
import { createEventFromClub } from "@/lib/actions/event";
import { ActionForm } from "@/components/host/ActionForm";
import { BellLink } from "@/components/nav/BellLink";
import { formatEventDate } from "@/lib/format";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

export default async function ClubHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; club?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club");

  const { club: requestedClubId } = await searchParams;
  const activeClubId =
    requestedClubId && actor.clubIds.includes(requestedClubId) ? requestedClubId : actor.clubIds[0];

  const myClub = activeClubId
    ? await prisma.club.findUnique({
        where: { id: activeClubId },
        include: {
          _count: { select: { roster: true, coaches: true } },
          requests: { where: { status: { in: ["PENDING", "PARTIAL"] } } },
          organizedEvents: { where: { status: { in: ["PUBLISHED", "LIVE", "INTERMISSION"] } }, orderBy: { date: "asc" }, take: 1 },
        },
      })
    : null;

  if (myClub) {
    const unreadCount = await prisma.notification.count({ where: { userId: actor.userId, read: false } });
    const nextTournament = myClub.organizedEvents[0] ?? null;

    const [upcomingFightCount, upcomingSparringCount] = await Promise.all([
      prisma.bout.count({
        where: {
          OR: [{ fighterA: { clubId: myClub.id } }, { fighterB: { clubId: myClub.id } }],
          status: { in: ["CONFIRMED", "READY", "DELAYED"] },
        },
      }),
      prisma.sparringParticipant.count({
        where: { session: { clubId: myClub.id, date: { gte: new Date() } }, status: { in: ["CONFIRMED", "INVITED"] } },
      }),
    ]);

    return (
      <div className="space-y-6 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{myClub.name}</h1>
            <p className="text-mute text-sm mt-1">{myClub.city ?? "—"} · {myClub._count.roster} boxers</p>
          </div>
          <BellLink unreadCount={unreadCount} />
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-card bg-panel border border-white/10 p-3">
            <p className="text-lg font-semibold tabular">{myClub._count.roster}</p>
            <p className="text-[10px] text-mute mt-0.5">Fighters</p>
          </div>
          <div className="rounded-card bg-panel border border-white/10 p-3">
            <p className="text-lg font-semibold tabular">{myClub._count.coaches}</p>
            <p className="text-[10px] text-mute mt-0.5">Coaches</p>
          </div>
          <div className="rounded-card bg-panel border border-white/10 p-3">
            <p className="text-lg font-semibold tabular">{upcomingSparringCount}</p>
            <p className="text-[10px] text-mute mt-0.5">Sparring</p>
          </div>
          <div className="rounded-card bg-panel border border-white/10 p-3">
            <p className="text-lg font-semibold tabular">{upcomingFightCount}</p>
            <p className="text-[10px] text-mute mt-0.5">Fights</p>
          </div>
        </div>

        {nextTournament && (
          <div className="rounded-card bg-panel border border-white/10 p-4">
            <p className="text-xs font-semibold text-mute uppercase tracking-wide">Next tournament</p>
            <p className="font-semibold mt-1">{nextTournament.name}</p>
            <p className="text-sm text-mute mt-0.5">{formatEventDate(nextTournament.date)}</p>
          </div>
        )}

        {myClub.requests.length > 0 && (
          <div className="rounded-card bg-panel border border-signal/30 p-4 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{myClub.requests.length} open request{myClub.requests.length > 1 ? "s" : ""}</p>
            <Link
              href="/club/requests"
              className="shrink-0 rounded-pill bg-signal text-onsignal px-3 py-1.5 text-xs font-semibold"
            >
              Review
            </Link>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Quick actions</p>
          <div className="grid grid-cols-2 gap-2">
            <form
              action={async () => {
                "use server";
                await createEventFromClub(myClub.id);
              }}
            >
              <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 text-sm">
                Create Event
              </button>
            </form>
            <Link
              href="/sparring/host/new"
              className="flex items-center justify-center rounded-pill border border-white/20 text-ink font-semibold py-3 text-sm"
            >
              Open Sparring
            </Link>
            <Link
              href="/club/roster"
              className="flex items-center justify-center rounded-pill border border-white/20 text-ink font-semibold py-3 text-sm"
            >
              Add Fighter
            </Link>
            <Link
              href="/sparring/host"
              className="flex items-center justify-center rounded-pill border border-white/20 text-ink font-semibold py-3 text-sm"
            >
              Match Sparring
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/club/roster" className="rounded-card bg-panel border border-white/10 p-4">
            <p className="font-semibold text-sm">Roster</p>
            <p className="text-xs text-mute mt-1">Fighters &amp; coaches</p>
          </Link>
          <Link href="/club/requests" className="rounded-card bg-panel border border-white/10 p-4">
            <p className="font-semibold text-sm">Requests</p>
            <p className="text-xs text-mute mt-1">Nominate boxers</p>
          </Link>
          <Link href="/club/tournaments" className="rounded-card bg-panel border border-white/10 p-4">
            <p className="font-semibold text-sm">Tournaments</p>
            <p className="text-xs text-mute mt-1">Hosting</p>
          </Link>
          <Link href="/sparring/host" className="rounded-card bg-panel border border-white/10 p-4">
            <p className="font-semibold text-sm">Sparring</p>
            <p className="text-xs text-mute mt-1">Host &amp; manage</p>
          </Link>
          <Link href="/club/analytics" className="rounded-card bg-panel border border-white/10 p-4 col-span-2">
            <p className="font-semibold text-sm">Analytics</p>
            <p className="text-xs text-mute mt-1">Attendance, activity, results</p>
          </Link>
        </div>
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
