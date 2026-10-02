import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { SparringNav } from "@/components/sparring/SparringNav";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function SparringHostPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/sparring/host");
  if (actor.clubIds.length === 0) {
    return (
      <div className="pt-10 text-center space-y-3">
        <p className="text-mute text-sm">Only club admins can host sparring sessions.</p>
        <Link href="/clubs" className={buttonClass({ variant: "outline", text: "sm", className: "inline-block px-5" })}>
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
        <Link href="/sparring/host/new" className={buttonClass({ size: "xs", text: "sm", className: "px-4" })}>
          + Create
        </Link>
      </div>

      <SparringNav active="host" registered={Boolean(actor)} />

      {sessions.length === 0 ? (
        <EmptyState centered>You haven&apos;t hosted any sparring sessions yet.</EmptyState>
      ) : (
        <>
          <SessionGroup title="Open" sessions={sessions.filter((s) => s.status === "OPEN")} />
          <SessionGroup title="Closed" sessions={sessions.filter((s) => s.status === "CLOSED")} />
          <SessionGroup title="Completed" sessions={sessions.filter((s) => s.status === "COMPLETED")} />
          <SessionGroup title="Cancelled" sessions={sessions.filter((s) => s.status === "CANCELLED")} />
        </>
      )}
    </div>
  );
}

function SessionGroup({
  title,
  sessions,
}: {
  title: string;
  sessions: { id: string; gym: string; city: string | null; date: Date; status: string; _count: { participants: number } }[];
}) {
  if (sessions.length === 0) return null;
  return (
    <section className="space-y-2">
      <p className="text-xs font-semibold text-mute uppercase tracking-wide">
        {title} ({sessions.length})
      </p>
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
    </section>
  );
}
