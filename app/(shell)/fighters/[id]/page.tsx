import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";

export default async function FighterProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const fighter = await prisma.fighterProfile.findUnique({
    where: { id },
    include: {
      club: true,
      boutsAsFighterA: { include: { event: true, fighterB: true, result: true } },
      boutsAsFighterB: { include: { event: true, fighterA: true, result: true } },
    },
  });

  if (!fighter) notFound();

  const bouts = [
    ...fighter.boutsAsFighterA.map((b) => ({
      id: b.id,
      event: b.event,
      opponent: b.fighterB?.displayName ?? "TBD",
      status: b.status,
      result: b.result,
      winnerId: b.result?.winnerId ?? null,
    })),
    ...fighter.boutsAsFighterB.map((b) => ({
      id: b.id,
      event: b.event,
      opponent: b.fighterA?.displayName ?? "TBD",
      status: b.status,
      result: b.result,
      winnerId: b.result?.winnerId ?? null,
    })),
  ]
    .filter((b) => b.event.status !== "DRAFT" && b.event.status !== "READY")
    .sort((a, b) => b.event.date.getTime() - a.event.date.getTime());

  const finished = bouts.filter((b) => b.status === "FINAL");
  const wins = finished.filter((b) => b.winnerId === fighter.id).length;
  const losses = finished.filter((b) => b.winnerId && b.winnerId !== fighter.id).length;

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h1 className="text-2xl font-semibold">{fighter.displayName}</h1>
        <p className="text-mute text-sm mt-1">
          {fighter.club ? (
            <Link href={`/clubs/${fighter.club.id}`} className="underline">
              {fighter.club.name}
            </Link>
          ) : (
            "Independent"
          )}
          {fighter.weightClass ? ` · ${fighter.weightClass}` : ""}
        </p>
        {finished.length > 0 && (
          <p className="text-xs text-mute mt-1">
            {wins}-{losses} in {finished.length} bout{finished.length > 1 ? "s" : ""}
          </p>
        )}
      </div>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Bouts</p>
        {bouts.length === 0 ? (
          <p className="text-sm text-mute">No bouts yet.</p>
        ) : (
          bouts.map((b) => (
            <Link
              key={b.id}
              href={b.event.slug ? `/e/${b.event.slug}/bout/${b.id}` : "#"}
              className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">vs {b.opponent}</p>
                <p className="text-xs text-mute mt-0.5">
                  {b.event.name} · {formatEventDate(b.event.date)}
                </p>
              </div>
              <span className="text-xs text-mute shrink-0 ml-2">
                {b.status === "FINAL"
                  ? b.winnerId === fighter.id
                    ? "Win"
                    : b.winnerId
                      ? "Loss"
                      : "Final"
                  : b.status}
              </span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
