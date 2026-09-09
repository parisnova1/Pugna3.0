import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { addRosterFighter } from "@/lib/actions/club";
import { ActionForm } from "@/components/host/ActionForm";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

export default async function ClubRosterPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club/roster");
  const clubId = actor.clubIds[0];
  if (!clubId) redirect("/club");

  const fighters = await prisma.fighterProfile.findMany({ where: { clubId }, orderBy: { displayName: "asc" } });

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">Roster</h1>

      {fighters.length === 0 ? (
        <p className="text-mute text-sm">No boxers yet.</p>
      ) : (
        <div className="space-y-2">
          {fighters.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3">
              <p className="text-sm font-medium">{f.displayName}</p>
              <p className="text-xs text-mute">{f.weightClass ?? "—"}</p>
            </div>
          ))}
        </div>
      )}

      <ActionForm action={addRosterFighter} submitLabel="Add boxer" className="space-y-3">
        <input type="hidden" name="clubId" value={clubId} />
        <input name="name" placeholder="Boxer name" required className={inputClass} />
        <input name="weightClass" placeholder="Weight class" className={inputClass} />
      </ActionForm>
    </div>
  );
}
