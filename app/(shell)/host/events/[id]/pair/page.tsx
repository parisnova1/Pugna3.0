import { requireHostEvent } from "@/lib/host-guard";
import { prisma } from "@/lib/prisma";
import { createBout } from "@/lib/actions/event";
import { ActionForm } from "@/components/host/ActionForm";
import { BackButton } from "@/components/event/ContextBar";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

export default async function PairStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireHostEvent(id, `/host/events/${id}/pair`);

  const nominations = await prisma.nomination.findMany({
    where: { eventId: id, status: { in: ["ACCEPTED", "CONFIRMED"] } },
    include: { fighter: true, club: true },
  });

  return (
    <div className="space-y-6 pt-2">
      <BackButton />
      <div>
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Step 4</p>
        <h1 className="text-2xl font-semibold">Pair</h1>
      </div>

      <div className="space-y-2">
        {event.bouts.length === 0 ? (
          <p className="text-sm text-mute">No bouts yet.</p>
        ) : (
          event.bouts.map((bout) => (
            <div key={bout.id} className="rounded-card bg-panel border border-white/10 px-4 py-3">
              <p className="text-sm font-medium">
                {bout.fighterA?.displayName ?? "TBD"} <span className="text-mute">vs</span> {bout.fighterB?.displayName ?? "TBD"}
              </p>
              <p className="text-xs text-mute mt-0.5">
                Bout {bout.number} · {bout.weightClass} · {bout.status}
              </p>
            </div>
          ))
        )}
      </div>

      {nominations.length < 1 ? (
        <p className="text-sm text-mute">Accept nominations or add guest boxers in Entries first.</p>
      ) : (
        <ActionForm action={createBout} submitLabel="Add bout" className="space-y-3">
          <input type="hidden" name="eventId" value={event.id} />
          <select name="fighterAId" className={inputClass}>
            <option value="">Boxer A (or TBD)</option>
            {nominations.map((nom) => (
              <option key={nom.fighter.id} value={nom.fighter.id}>
                {nom.fighter.displayName} · {nom.club.name}
              </option>
            ))}
          </select>
          <select name="fighterBId" className={inputClass}>
            <option value="">Boxer B (or TBD)</option>
            {nominations.map((nom) => (
              <option key={nom.fighter.id} value={nom.fighter.id}>
                {nom.fighter.displayName} · {nom.club.name}
              </option>
            ))}
          </select>
          <input name="weightClass" placeholder="Weight class" required className={inputClass} />
        </ActionForm>
      )}
    </div>
  );
}
