import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { formatEventDate } from "@/lib/format";
import { WeightTag } from "@/components/ui/WeightTag";
import { FighterFollowButton } from "@/components/fighters/FighterFollowButton";
import { NextFightPanel } from "@/components/live/NextFightPanel";

const UPCOMING_STATUSES = ["TBD", "CONFIRMED", "READY", "DELAYED", "IN_PROGRESS"];

export default async function FighterProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoAlert?: string }>;
}) {
  const { id } = await params;
  const { autoAlert } = await searchParams;

  const fighter = await prisma.fighterProfile.findUnique({
    where: { id },
    include: {
      club: true,
      boutsAsFighterA: { include: { event: true, fighterB: true, result: true, ring: true } },
      boutsAsFighterB: { include: { event: true, fighterA: true, result: true, ring: true } },
    },
  });

  if (!fighter) notFound();

  const actor = await getActor();
  const following = actor
    ? Boolean(await prisma.fighterFollow.findUnique({ where: { userId_fighterId: { userId: actor.userId, fighterId: fighter.id } } }))
    : false;

  const bouts = [
    ...fighter.boutsAsFighterA.map((b) => ({
      id: b.id,
      event: b.event,
      opponentId: b.fighterB?.id ?? null,
      opponent: b.fighterB?.displayName ?? "TBD",
      status: b.status,
      result: b.result,
      winnerId: b.result?.winnerId ?? null,
      number: b.number,
      weightClass: b.weightClass,
      ringName: b.ring.name ?? `Ring ${b.ring.number}`,
    })),
    ...fighter.boutsAsFighterB.map((b) => ({
      id: b.id,
      event: b.event,
      opponentId: b.fighterA?.id ?? null,
      opponent: b.fighterA?.displayName ?? "TBD",
      status: b.status,
      result: b.result,
      winnerId: b.result?.winnerId ?? null,
      number: b.number,
      weightClass: b.weightClass,
      ringName: b.ring.name ?? `Ring ${b.ring.number}`,
    })),
  ]
    .filter((b) => b.event.status !== "DRAFT" && b.event.status !== "READY")
    .sort((a, b) => b.event.date.getTime() - a.event.date.getTime());

  const finished = bouts.filter((b) => b.status === "FINAL");
  const wins = finished.filter((b) => b.winnerId === fighter.id).length;
  const losses = finished.filter((b) => b.winnerId && b.winnerId !== fighter.id).length;
  const draws = finished.filter((b) => !b.winnerId).length;
  const opponentsFaced = new Set(finished.map((b) => b.opponentId).filter(Boolean)).size;

  // Soonest upcoming/in-progress bout, regardless of event — distinct from the
  // Bout Detail winner panel's "next bout after this one in the same event."
  const nextFight = [...bouts.filter((b) => UPCOMING_STATUSES.includes(b.status))].sort(
    (a, b) => a.event.date.getTime() - b.event.date.getTime(),
  )[0] ?? null;
  const lastResult = finished[0] ?? null;

  const alertOn =
    actor && nextFight
      ? Boolean(
          await prisma.fighterNextBoutAlert.findUnique({
            where: { userId_fighterId_eventId: { userId: actor.userId, fighterId: fighter.id, eventId: nextFight.event.id } },
          }),
        )
      : false;

  return (
    <div className="space-y-6 pt-2">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
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
          </div>
          <FighterFollowButton fighterId={fighter.id} isGuest={!actor} following={following} />
        </div>

        <p className="text-3xl font-bold tabular">
          {wins}–{losses}–{draws}
        </p>

        {(fighter.stance || fighter.style) && (
          <div className="flex gap-2 flex-wrap">
            {fighter.stance && <WeightTag>{fighter.stance}</WeightTag>}
            {fighter.style && <WeightTag>{fighter.style}</WeightTag>}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 pt-2">
          <div className="rounded-card bg-panel border border-white/10 p-3 text-center">
            <p className="text-lg font-semibold tabular">{finished.length}</p>
            <p className="text-[11px] text-mute mt-0.5">Fights</p>
          </div>
          <div className="rounded-card bg-panel border border-white/10 p-3 text-center">
            <p className="text-lg font-semibold tabular">{opponentsFaced}</p>
            <p className="text-[11px] text-mute mt-0.5">Opponents</p>
          </div>
          <div className="rounded-card bg-panel border border-white/10 p-3 text-center">
            <p className="text-lg font-semibold tabular">—</p>
            <p className="text-[11px] text-mute mt-0.5">Sparring</p>
          </div>
        </div>

        {lastResult && (
          <div className="rounded-card bg-panel border border-white/10 p-3">
            <p className="text-xs font-semibold text-mute uppercase tracking-wide mb-1">Last result</p>
            <p className="text-sm font-medium">
              <span className={lastResult.winnerId === fighter.id ? "text-success font-semibold" : ""}>
                {lastResult.winnerId === fighter.id ? "🏆 Win" : lastResult.winnerId ? "Loss" : "Draw"}
              </span>
              <span className="text-mute">
                {" "}
                · {lastResult.result?.method}
                {lastResult.result?.round ? ` · Round ${lastResult.result.round}` : ""}
              </span>
            </p>
          </div>
        )}
      </div>

      {nextFight && nextFight.event.slug && (
        <NextFightPanel
          fighterId={fighter.id}
          fighterName={fighter.displayName}
          eventId={nextFight.event.id}
          slug={nextFight.event.slug}
          isGuest={!actor}
          alertOn={alertOn}
          autoAlertFighterId={autoAlert}
          nextBout={{
            id: nextFight.id,
            opponentName: nextFight.opponent,
            weightClass: nextFight.weightClass,
            number: nextFight.number,
            ringName: nextFight.ringName,
          }}
        />
      )}

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
              <span
                className={`text-xs shrink-0 ml-2 font-medium ${
                  b.status === "FINAL" && b.winnerId === fighter.id ? "text-success" : "text-mute"
                }`}
              >
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
