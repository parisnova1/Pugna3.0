import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { suggestMatches, ageFromDob, type MatchCandidate } from "@/lib/matchmaking";
import { createMatch } from "@/lib/actions/sparring";
import { BackButton } from "@/components/event/ContextBar";

export default async function SparringMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor) redirect(`/account?returnTo=/sparring/${id}/match`);

  const session = await prisma.sparringSession.findUnique({
    where: { id },
    include: {
      participants: {
        where: { status: "CONFIRMED" },
        include: { fighter: { include: { club: true } }, weightGroup: true },
      },
      matches: true,
    },
  });
  if (!session) notFound();
  if (!can(actor, "club.admin", { clubId: session.clubId }).allowed) redirect(`/sparring/${id}`);

  const matchedParticipantIds = new Set(session.matches.flatMap((m) => [m.participantAId, m.participantBId]));
  const unmatched = session.participants.filter((p) => !matchedParticipantIds.has(p.id));

  const candidates: MatchCandidate[] = unmatched.map((p) => ({
    participantId: p.id,
    fighterId: p.fighterId,
    displayName: p.fighter.displayName,
    clubName: p.fighter.club?.name ?? null,
    weightGroupLabel: p.weightGroup?.label ?? p.fighter.weightClass ?? null,
    sex: p.fighter.sex,
    experienceLevel: p.fighter.experienceLevel,
    age: ageFromDob(p.fighter.dateOfBirth),
  }));

  const suggestions = suggestMatches(candidates).slice(0, 8);

  const confirmedMatches = await prisma.sparringMatch.findMany({
    where: { sessionId: id },
    include: {
      participantA: { include: { fighter: true } },
      participantB: { include: { fighter: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 pt-2">
      <BackButton />
      <h1 className="text-2xl font-semibold">Suggested Matches</h1>

      {confirmedMatches.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Confirmed</p>
          {confirmedMatches.map((m) => (
            <div key={m.id} className="rounded-card bg-panel border border-signal/30 p-4">
              <p className="text-sm font-medium">
                {m.participantA.fighter.displayName} <span className="text-mute font-normal">vs</span>{" "}
                {m.participantB.fighter.displayName}
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Suggested</p>
        {suggestions.length === 0 ? (
          <p className="text-sm text-mute">No confirmed fighters left to match.</p>
        ) : (
          suggestions.map((pair, i) => (
            <div key={i} className="rounded-card bg-panel border border-white/10 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="font-semibold text-sm">{pair.a.displayName}</p>
                  <p className="text-xs text-mute mt-0.5">{pair.a.weightGroupLabel ?? "—"}</p>
                  <p className="text-xs text-mute">{pair.a.experienceLevel ?? "—"}</p>
                  <p className="text-[11px] text-mute mt-0.5">{pair.a.clubName ?? "Independent"}</p>
                </div>
                <div>
                  <p className="font-semibold text-sm">{pair.b.displayName}</p>
                  <p className="text-xs text-mute mt-0.5">{pair.b.weightGroupLabel ?? "—"}</p>
                  <p className="text-xs text-mute">{pair.b.experienceLevel ?? "—"}</p>
                  <p className="text-[11px] text-mute mt-0.5">{pair.b.clubName ?? "Independent"}</p>
                </div>
              </div>
              <p className="text-center text-[11px] text-mute">Compatibility {pair.score}%</p>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await createMatch(id, formData);
                }}
              >
                <input type="hidden" name="participantAId" value={pair.a.participantId} />
                <input type="hidden" name="participantBId" value={pair.b.participantId} />
                <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-2.5 text-sm">
                  Create Match
                </button>
              </form>
            </div>
          ))
        )}
      </section>

      <Link href={`/sparring/${id}`} className="block text-center text-sm text-mute underline">
        Back to session
      </Link>
    </div>
  );
}
