import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";

export default async function SparringHostPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/sparring/host");
  if (actor.clubIds.length === 0) {
    return (
      <div className="pt-10 text-center space-y-3">
        <p className="text-mute text-sm">Only club admins can host sparring sessions.</p>
        <Link href="/clubs" className="inline-block rounded-pill border border-white/20 text-ink font-semibold px-5 py-3 text-sm">
          Browse clubs
        </Link>
      </div>
    );
  }

  const sessions = await prisma.sparringSession.findMany({
    where: { clubId: { in: actor.clubIds } },
    orderBy: { date: "desc" },
    include: { club: true, _count: { select: { participants: true } } },
  });

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Host Sparring</h1>
        <Link href="/sparring/host/new" className="rounded-pill bg-signal text-onsignal font-semibold px-4 py-2 text-sm">
          + Create
        </Link>
      </div>

      <nav className="flex gap-2 overflow-x-auto text-sm">
        <Link href="/sparring" className="rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap">
          Discover
        </Link>
        <Link href="/sparring/mine" className="rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap">
          My Sparring
        </Link>
        <span className="rounded-pill border border-signal bg-signal/10 px-4 py-2 font-medium whitespace-nowrap">Host</span>
        <Link href="/sparring/requests" className="rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap">
          Requests
        </Link>
      </nav>

      {sessions.length === 0 ? (
        <p className="text-sm text-mute text-center py-10">You haven&apos;t hosted any sparring sessions yet.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/sparring/${session.id}`}
              className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {session.gym}
                  {session.city ? ` · ${session.city}` : ""}
                </p>
                <p className="text-xs text-mute mt-0.5">
                  {formatEventDate(session.date)} · {session._count.participants} fighter
                  {session._count.participants === 1 ? "" : "s"}
                </p>
              </div>
              <Badge tone={session.status === "OPEN" ? "signal" : "neutral"}>{session.status}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
