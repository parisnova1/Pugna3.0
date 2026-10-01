import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { addRosterFighter } from "@/lib/actions/club";
import { getClubRelatedEvents } from "@/lib/club-events";
import { ActionForm } from "@/components/host/ActionForm";
import { ClubNav } from "@/components/club/ClubNav";
import { NominateFighterFlow } from "@/components/club/NominateFighterFlow";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

function ageFromDob(dob: Date | null): number | null {
  if (!dob) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export default async function ClubFightersPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club/fighters");

  const { club: requestedClubId } = await searchParams;
  const clubId = requestedClubId && actor.clubIds.includes(requestedClubId) ? requestedClubId : actor.clubIds[0];
  if (!clubId) redirect("/club");

  const [fighters, relatedEvents] = await Promise.all([
    prisma.fighterProfile.findMany({ where: { clubId }, orderBy: { displayName: "asc" } }),
    getClubRelatedEvents(clubId),
  ]);

  const fighterIds = fighters.map((f) => f.id);
  const finishedBouts =
    fighterIds.length > 0
      ? await prisma.bout.findMany({
          where: { OR: [{ fighterAId: { in: fighterIds } }, { fighterBId: { in: fighterIds } }], status: "FINAL" },
          select: { fighterAId: true, fighterBId: true, result: { select: { winnerId: true } } },
        })
      : [];

  const recordByFighter = new Map<string, { w: number; l: number; d: number }>();
  for (const id of fighterIds) recordByFighter.set(id, { w: 0, l: 0, d: 0 });
  for (const bout of finishedBouts) {
    if (!bout.result) continue;
    const winnerId = bout.result.winnerId;
    for (const fid of [bout.fighterAId, bout.fighterBId]) {
      if (!fid) continue;
      const rec = recordByFighter.get(fid);
      if (!rec) continue;
      if (!winnerId) rec.d++;
      else if (winnerId === fid) rec.w++;
      else rec.l++;
    }
  }

  const fighterOptions = fighters.map((f) => ({ id: f.id, name: f.displayName, weightClass: f.weightClass }));

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">Club Fighters</h1>
      <ClubNav active="fighters" />

      <NominateFighterFlow clubId={clubId} events={relatedEvents} fighters={fighterOptions} />

      {fighters.length === 0 ? (
        <p className="text-mute text-sm">No boxers yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {fighters.map((f) => {
            const age = ageFromDob(f.dateOfBirth);
            const rec = recordByFighter.get(f.id);
            const hasRecord = rec && rec.w + rec.l + rec.d > 0;
            return (
              <div key={f.id} className="rounded-card bg-panel border border-white/10 p-3 space-y-1">
                <p className="text-sm font-semibold truncate">{f.displayName}</p>
                <p className="text-xs text-mute">
                  {[age ? `${age}y` : null, f.weightClass].filter(Boolean).join(" · ") || "—"}
                </p>
                {hasRecord && (
                  <p className="text-xs text-mute tabular">
                    {rec!.w}–{rec!.l}–{rec!.d}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ActionForm action={addRosterFighter} submitLabel="+ Add Fighter" className="space-y-3">
        <input type="hidden" name="clubId" value={clubId} />
        <input name="name" placeholder="Boxer name" required className={inputClass} />
        <input name="weightClass" placeholder="Weight class" className={inputClass} />
      </ActionForm>
    </div>
  );
}
