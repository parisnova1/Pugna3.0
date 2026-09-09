import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";

export default async function YourFightsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/you/fights");

  const fighter = await prisma.fighterProfile.findUnique({ where: { userId: actor.userId } });
  if (!fighter) redirect("/you");

  const { tab } = await searchParams;
  const showPast = tab === "past";

  const bouts = await prisma.bout.findMany({
    where: { OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }] },
    include: { event: true, fighterA: true, fighterB: true, result: true },
    orderBy: { event: { date: "desc" } },
  });

  const terminal = ["FINAL", "SCRATCHED", "NO_SHOW"];
  const upcoming = bouts.filter((b) => !terminal.includes(b.status));
  const past = bouts.filter((b) => terminal.includes(b.status));
  const shown = showPast ? past : upcoming;

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-2xl font-semibold">My Fights</h1>

      <div className="flex gap-2">
        <Link
          href="/you/fights"
          className={[
            "rounded-pill px-4 py-2 text-sm font-medium border",
            !showPast ? "bg-ink text-void border-ink" : "border-white/15 text-mute",
          ].join(" ")}
        >
          Upcoming
        </Link>
        <Link
          href="/you/fights?tab=past"
          className={[
            "rounded-pill px-4 py-2 text-sm font-medium border",
            showPast ? "bg-ink text-void border-ink" : "border-white/15 text-mute",
          ].join(" ")}
        >
          Past
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className="text-mute text-sm">{showPast ? "No past fights yet." : "Nothing scheduled."}</p>
      ) : (
        <div className={showPast ? "space-y-2 opacity-80" : "space-y-2"}>
          {shown.map((b) => (
            <Link
              key={b.id}
              href={b.event.slug ? `/e/${b.event.slug}/bout/${b.id}` : "#"}
              className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{b.event.name}</p>
                <p className="text-xs text-mute">
                  {formatEventDate(b.event.date)} · {showPast ? b.result?.method ?? b.status : b.weightClass}
                </p>
              </div>
              <span className="text-xs text-mute">{b.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
