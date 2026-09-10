import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";
import { respondToParticipant } from "@/lib/actions/sparring";
import { respondToClubInvite, respondToClubRequest, respondToNomination, withdrawNomination } from "@/lib/actions/sparringClub";
import { SparringNav } from "@/components/sparring/SparringNav";

export default async function SparringRequestsPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/sparring/requests");
  if (actor.clubIds.length === 0) redirect("/sparring");

  const clubIds = actor.clubIds;

  const [openRequests, clubInvitesReceived, clubRequestsToRespond, nominationsToRespond, myClubNominations] =
    await Promise.all([
      prisma.sparringParticipant.findMany({
        where: { status: "REQUESTED", session: { clubId: { in: clubIds } } },
        include: { fighter: { include: { club: true } }, session: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.sparringClubInvite.findMany({
        where: { invitedClubId: { in: clubIds }, status: "PENDING" },
        include: { session: { include: { club: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.sparringClubRequest.findMany({
        where: { session: { clubId: { in: clubIds } }, status: "PENDING" },
        include: { session: true, requestingClub: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.sparringNomination.findMany({
        where: { session: { clubId: { in: clubIds } }, status: "PENDING" },
        include: { session: true, fighter: true, nominatingClub: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.sparringNomination.findMany({
        where: { nominatingClubId: { in: clubIds }, status: "PENDING" },
        include: { session: { include: { club: true } }, fighter: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const nothingPending =
    openRequests.length === 0 &&
    clubInvitesReceived.length === 0 &&
    clubRequestsToRespond.length === 0 &&
    nominationsToRespond.length === 0 &&
    myClubNominations.length === 0;

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">Sparring Requests</h1>

      <SparringNav active="requests" registered={Boolean(actor)} />

      {nothingPending && <p className="text-sm text-mute text-center py-10">Nothing pending.</p>}

      {clubInvitesReceived.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Club invites you&apos;ve received</p>
          {clubInvitesReceived.map((inv) => (
            <div key={inv.id} className="rounded-card bg-panel border border-white/10 p-4 space-y-2">
              <Link href={`/sparring/${inv.sessionId}`} className="block">
                <p className="text-sm font-medium">{inv.session.club.name}</p>
                <p className="text-xs text-mute mt-0.5">
                  {inv.session.gym} · {formatEventDate(inv.session.date)}
                </p>
              </Link>
              <div className="flex gap-2">
                <form
                  action={async () => {
                    "use server";
                    await respondToClubInvite(inv.id, true);
                  }}
                  className="flex-1"
                >
                  <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-2 text-xs">
                    Accept
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await respondToClubInvite(inv.id, false);
                  }}
                  className="flex-1"
                >
                  <button type="submit" className="w-full rounded-pill border border-white/20 py-2 text-xs font-medium">
                    Decline
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      {clubRequestsToRespond.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Requests to your sessions</p>
          {clubRequestsToRespond.map((r) => (
            <div key={r.id} className="rounded-card bg-panel border border-white/10 p-4 space-y-2">
              <Link href={`/sparring/${r.sessionId}`} className="block">
                <p className="text-sm font-medium">{r.requestingClub.name}</p>
                <p className="text-xs text-mute mt-0.5">
                  wants {r.session.gym} · {formatEventDate(r.session.date)}
                </p>
              </Link>
              <div className="flex gap-2">
                <form
                  action={async () => {
                    "use server";
                    await respondToClubRequest(r.id, true);
                  }}
                  className="flex-1"
                >
                  <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-2 text-xs">
                    Accept
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await respondToClubRequest(r.id, false);
                  }}
                  className="flex-1"
                >
                  <button type="submit" className="w-full rounded-pill border border-white/20 py-2 text-xs font-medium">
                    Decline
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      {nominationsToRespond.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Nominations awaiting your approval</p>
          {nominationsToRespond.map((n) => (
            <div key={n.id} className="rounded-card bg-panel border border-white/10 p-4 space-y-2">
              <Link href={`/sparring/${n.sessionId}`} className="block">
                <p className="text-sm font-medium">{n.fighter.displayName}</p>
                <p className="text-xs text-mute mt-0.5">
                  {n.nominatingClub.name} · {n.session.gym} · {formatEventDate(n.session.date)}
                </p>
              </Link>
              <div className="flex gap-2">
                <form
                  action={async () => {
                    "use server";
                    await respondToNomination(n.id, true);
                  }}
                  className="flex-1"
                >
                  <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-2 text-xs">
                    Accept
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await respondToNomination(n.id, false);
                  }}
                  className="flex-1"
                >
                  <button type="submit" className="w-full rounded-pill border border-white/20 py-2 text-xs font-medium">
                    Decline
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      {myClubNominations.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Your club&apos;s pending nominations</p>
          {myClubNominations.map((n) => (
            <div key={n.id} className="rounded-card bg-panel border border-white/10 p-4 flex items-center justify-between">
              <Link href={`/sparring/${n.sessionId}`}>
                <p className="text-sm font-medium">{n.fighter.displayName}</p>
                <p className="text-xs text-mute mt-0.5">
                  {n.session.club.name} · {n.session.gym} · {formatEventDate(n.session.date)}
                </p>
              </Link>
              <form
                action={async () => {
                  "use server";
                  await withdrawNomination(n.id);
                }}
              >
                <button type="submit" className="text-xs text-mute underline">
                  Withdraw
                </button>
              </form>
            </div>
          ))}
        </section>
      )}

      {openRequests.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Session requests</p>
          {openRequests.map((r) => (
            <div key={r.id} className="rounded-card bg-panel border border-white/10 p-4 space-y-2">
              <Link href={`/sparring/${r.sessionId}`} className="block">
                <p className="text-sm font-medium">{r.fighter.displayName}</p>
                <p className="text-xs text-mute mt-0.5">
                  {r.fighter.club?.name ?? "Independent"} · wants {r.session.gym} · {formatEventDate(r.session.date)}
                </p>
              </Link>
              <div className="flex gap-2">
                <form
                  action={async () => {
                    "use server";
                    await respondToParticipant(r.id, true);
                  }}
                  className="flex-1"
                >
                  <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-2 text-xs">
                    Accept
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await respondToParticipant(r.id, false);
                  }}
                  className="flex-1"
                >
                  <button type="submit" className="w-full rounded-pill border border-white/20 py-2 text-xs font-medium">
                    Reject
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
