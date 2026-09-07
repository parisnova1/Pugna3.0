import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";

export default async function YourFightsPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/you/fights");

  const fighter = await prisma.fighterProfile.findUnique({ where: { userId: actor.userId } });
  if (!fighter) redirect("/you");

  const bouts = await prisma.bout.findMany({
    where: { OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }] },
    include: { event: true, fighterA: true, fighterB: true },
    orderBy: { event: { date: "desc" } },
  });

  const upcoming = bouts.filter((b) => !["FINAL", "SCRATCHED", "NO_SHOW"].includes(b.status));

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-2xl font-semibold">Your fights</h1>
      {upcoming.length === 0 ? (
        <p className="text-mute text-sm">Nothing scheduled.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((b) => (
            <Link
              key={b.id}
              href={b.event.slug ? `/e/${b.event.slug}/bout/${b.id}` : "#"}
              className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{b.event.name}</p>
                <p className="text-xs text-mute">{formatEventDate(b.event.date)} · {b.weightClass}</p>
              </div>
              <span className="text-xs text-mute">{b.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
