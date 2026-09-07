import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";

export default async function YourHistoryPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/you/history");

  const fighter = await prisma.fighterProfile.findUnique({ where: { userId: actor.userId } });
  if (!fighter) redirect("/you");

  const bouts = await prisma.bout.findMany({
    where: {
      OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }],
      status: { in: ["FINAL", "SCRATCHED", "NO_SHOW"] },
    },
    include: { event: true, fighterA: true, fighterB: true, result: true },
    orderBy: { event: { date: "desc" } },
  });

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-2xl font-semibold">History</h1>
      {bouts.length === 0 ? (
        <p className="text-mute text-sm">No past bouts yet.</p>
      ) : (
        <div className="space-y-2 opacity-80">
          {bouts.map((b) => (
            <div key={b.id} className="rounded-card bg-panel border border-white/10 px-4 py-3">
              <p className="text-sm font-medium">{b.event.name}</p>
              <p className="text-xs text-mute mt-0.5">
                {formatEventDate(b.event.date)} · {b.result?.method ?? b.status}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
