import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";
import { respondToParticipant } from "@/lib/actions/sparring";

export default async function SparringRequestsPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/sparring/requests");
  if (actor.clubIds.length === 0) redirect("/sparring");

  const requests = await prisma.sparringParticipant.findMany({
    where: { status: "REQUESTED", session: { clubId: { in: actor.clubIds } } },
    include: { fighter: { include: { club: true } }, session: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">Sparring Requests</h1>

      <nav className="flex gap-2 overflow-x-auto text-sm">
        <Link href="/sparring" className="rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap">
          Discover
        </Link>
        <Link href="/sparring/mine" className="rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap">
          My Sparring
        </Link>
        <Link href="/sparring/host" className="rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap">
          Host
        </Link>
        <span className="rounded-pill border border-signal bg-signal/10 px-4 py-2 font-medium whitespace-nowrap">Requests</span>
      </nav>

      {requests.length === 0 ? (
        <p className="text-sm text-mute text-center py-10">No pending sparring requests.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
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
        </div>
      )}
    </div>
  );
}
