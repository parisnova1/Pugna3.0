import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import type { SparringParticipantStatus } from "@prisma/client";

const STATUS_LABEL: Record<SparringParticipantStatus, string> = {
  REQUESTED: "Requested",
  INVITED: "Invited",
  CONFIRMED: "Confirmed",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
  CHECKED_IN: "Checked in",
  COMPLETED: "Completed",
  NO_SHOW: "No-show",
};

export default async function MySparringPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/sparring/mine");

  const fighter = await prisma.fighterProfile.findUnique({ where: { userId: actor.userId } });

  const participations = fighter
    ? await prisma.sparringParticipant.findMany({
        where: { fighterId: fighter.id },
        include: { session: { include: { club: true } } },
        orderBy: { session: { date: "desc" } },
      })
    : [];

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">My Sparring</h1>

      <nav className="flex gap-2 overflow-x-auto text-sm">
        <Link href="/sparring" className="rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap">
          Discover
        </Link>
        <span className="rounded-pill border border-signal bg-signal/10 px-4 py-2 font-medium whitespace-nowrap">My Sparring</span>
        <Link href="/sparring/host" className="rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap">
          Host
        </Link>
        <Link href="/sparring/requests" className="rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap">
          Requests
        </Link>
      </nav>

      {!fighter ? (
        <p className="text-sm text-mute text-center py-10">Register as a fighter to join sparring sessions.</p>
      ) : participations.length === 0 ? (
        <p className="text-sm text-mute text-center py-10">You haven&apos;t joined any sparring sessions yet.</p>
      ) : (
        <div className="space-y-2">
          {participations.map((p) => (
            <Link
              key={p.id}
              href={`/sparring/${p.sessionId}`}
              className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{p.session.club.name}</p>
                <p className="text-xs text-mute mt-0.5">
                  {p.session.gym} · {formatEventDate(p.session.date)}
                </p>
              </div>
              <Badge tone={p.status === "CONFIRMED" ? "signal" : "neutral"}>{STATUS_LABEL[p.status]}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
