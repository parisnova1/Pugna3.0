import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { BackButton } from "@/components/event/ContextBar";

export default async function ClubAnalyticsPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club/analytics");
  const clubId = actor.clubIds[0];
  if (!clubId) redirect("/club");

  const fighters = await prisma.fighterProfile.findMany({ where: { clubId }, select: { id: true, weightClass: true } });
  const fighterIds = fighters.map((f) => f.id);
  const sessionIds = (await prisma.sparringSession.findMany({ where: { clubId }, select: { id: true } })).map((s) => s.id);

  const [
    coachCount,
    sessionCount,
    registrationCount,
    noShowCount,
    finishedBouts,
    eventsHosted,
  ] = await Promise.all([
    prisma.coach.count({ where: { clubId } }),
    Promise.resolve(sessionIds.length),
    prisma.sparringParticipant.count({ where: { session: { clubId } } }),
    prisma.checkIn.count({ where: { attachedType: "SPARRING_SESSION", status: "NO_SHOW", attachedId: { in: sessionIds } } }),
    prisma.bout.findMany({
      where: { OR: [{ fighterAId: { in: fighterIds } }, { fighterBId: { in: fighterIds } }], status: "FINAL" },
      include: { result: true },
    }),
    prisma.event.groupBy({ by: ["status"], where: { organizingClubId: clubId }, _count: true }),
  ]);

  const wins = finishedBouts.filter((b) => b.result && fighterIds.includes(b.result.winnerId ?? "")).length;
  const losses = finishedBouts.filter((b) => b.result?.winnerId && !fighterIds.includes(b.result.winnerId)).length;
  const draws = finishedBouts.filter((b) => b.result && !b.result.winnerId).length;

  const weightGroups = new Map<string, number>();
  for (const f of fighters) {
    const key = f.weightClass ?? "Unspecified";
    weightGroups.set(key, (weightGroups.get(key) ?? 0) + 1);
  }
  const weightDistribution = [...weightGroups.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8 pt-2">
      <BackButton />
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <section className="grid grid-cols-2 gap-3">
        <Stat label="Fighters" value={fighters.length} />
        <Stat label="Coaches" value={coachCount} />
        <Stat label="Sparring sessions" value={sessionCount} />
        <Stat label="Sparring registrations" value={registrationCount} />
        <Stat label="No-shows" value={noShowCount} />
        <Stat label="Finished fights" value={finishedBouts.length} />
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Club fight record</p>
        <p className="text-3xl font-bold tabular">
          {wins}–{losses}–{draws}
        </p>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Weight distribution</p>
        {weightDistribution.length === 0 ? (
          <p className="text-sm text-mute">No fighters yet.</p>
        ) : (
          <div className="space-y-1">
            {weightDistribution.map(([label, count]) => (
              <div key={label} className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-2 text-sm">
                <span>{label}</span>
                <span className="text-mute tabular">{count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Events hosted</p>
        {eventsHosted.length === 0 ? (
          <p className="text-sm text-mute">No events hosted yet.</p>
        ) : (
          <div className="space-y-1">
            {eventsHosted.map((g) => (
              <div key={g.status} className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-2 text-sm">
                <span>{g.status}</span>
                <span className="text-mute tabular">{g._count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card bg-panel border border-white/10 p-4 text-center">
      <p className="text-2xl font-semibold tabular">{value}</p>
      <p className="text-[11px] text-mute mt-1">{label}</p>
    </div>
  );
}
