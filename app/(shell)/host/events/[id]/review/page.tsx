import { requireHostEvent } from "@/lib/host-guard";
import { publishEvent } from "@/lib/actions/event";
import { BackButton } from "@/components/event/ContextBar";

export default async function ReviewStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireHostEvent(id, `/host/events/${id}/review`);

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!event.venue && !event.city) blockers.push("Add a venue or city.");
  if (event.bouts.length === 0) blockers.push("Add at least one bout.");
  for (const bout of event.bouts) {
    if (!bout.fighterAId && !bout.fighterBId) blockers.push(`Bout ${bout.number} has no boxers.`);
    else if (!bout.fighterAId || !bout.fighterBId) warnings.push(`Bout ${bout.number} has a TBD opponent.`);
  }

  const canPublish = blockers.length === 0 && (event.status === "DRAFT" || event.status === "READY");

  return (
    <div className="space-y-6 pt-2">
      <BackButton />
      <div>
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Step 6</p>
        <h1 className="text-2xl font-semibold">Review &amp; publish</h1>
      </div>

      {blockers.length > 0 && (
        <div className="rounded-card border border-signal/40 bg-signal/5 p-4 space-y-1">
          <p className="text-xs font-semibold text-signal uppercase tracking-wide">Blockers</p>
          {blockers.map((b) => (
            <p key={b} className="text-sm">{b}</p>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-card border border-white/10 bg-panel p-4 space-y-1">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Warnings</p>
          {warnings.map((w) => (
            <p key={w} className="text-sm text-mute">{w}</p>
          ))}
        </div>
      )}

      {blockers.length === 0 && warnings.length === 0 && (
        <p className="text-sm text-mute">Everything checks out.</p>
      )}

      {event.status === "PUBLISHED" || event.status === "LIVE" || event.status === "INTERMISSION" ? (
        <p className="text-sm text-mute text-center">This event is already published.</p>
      ) : (
        <form
          action={async () => {
            "use server";
            await publishEvent(event.id);
          }}
        >
          <button
            type="submit"
            disabled={!canPublish}
            className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-40"
          >
            Publish
          </button>
        </form>
      )}
    </div>
  );
}
