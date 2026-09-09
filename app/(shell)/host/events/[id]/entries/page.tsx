import { requireHostEvent } from "@/lib/host-guard";
import { addGuestFighter } from "@/lib/actions/event";
import { requestClub } from "@/lib/actions/request";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/host/ActionForm";
import { BackButton } from "@/components/event/ContextBar";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

export default async function EntriesStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireHostEvent(id, `/host/events/${id}/entries`);

  const [clubs, requests, nominations] = await Promise.all([
    prisma.club.findMany({ orderBy: { name: "asc" }, take: 50 }),
    prisma.eventRequest.findMany({ where: { eventId: id }, include: { club: true } }),
    prisma.nomination.findMany({ where: { eventId: id }, include: { fighter: true, club: true } }),
  ]);

  return (
    <div className="space-y-8 pt-2">
      <BackButton />
      <div>
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Step 3</p>
        <h1 className="text-2xl font-semibold">Entries</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Nominations</h2>
        {nominations.length === 0 ? (
          <p className="text-sm text-mute">No nominations yet.</p>
        ) : (
          <div className="space-y-2">
            {nominations.map((nom) => (
              <div key={nom.id} className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{nom.fighter.displayName}</p>
                  <p className="text-xs text-mute mt-0.5">{nom.club.name} · {nom.weightClass}</p>
                </div>
                <span className="text-xs text-mute">{nom.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Request a club</h2>
        {requests.length > 0 && (
          <div className="space-y-1 mb-2">
            {requests.map((req) => (
              <p key={req.id} className="text-xs text-mute">
                {req.club.name} — {req.status}
              </p>
            ))}
          </div>
        )}
        {clubs.length === 0 ? (
          <p className="text-sm text-mute">No clubs on Pugna yet — add a guest boxer below instead.</p>
        ) : (
          <ActionForm action={requestClub} submitLabel="Send request" className="space-y-3">
            <input type="hidden" name="eventId" value={event.id} />
            <select name="clubId" required className={inputClass}>
              <option value="">Select club</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input name="weightClass" placeholder="Weight class" required className={inputClass} />
              <input name="need" type="number" min={1} defaultValue={1} className={inputClass} />
            </div>
          </ActionForm>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Guest boxer</h2>
        <p className="text-xs text-mute">Not in the app.</p>
        <ActionForm action={addGuestFighter} submitLabel="Add guest boxer" className="space-y-3">
          <input type="hidden" name="eventId" value={event.id} />
          <input name="name" placeholder="Boxer name" required className={inputClass} />
          <input name="clubText" placeholder="Club (text)" className={inputClass} />
          <input name="weightClass" placeholder="Weight class" className={inputClass} />
        </ActionForm>
      </section>
    </div>
  );
}
