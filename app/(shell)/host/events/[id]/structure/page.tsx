import { requireHostEvent } from "@/lib/host-guard";
import { updateEventStructure } from "@/lib/actions/event";
import { ActionForm } from "@/components/host/ActionForm";
import { BackButton } from "@/components/event/ContextBar";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

export default async function StructureStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireHostEvent(id, `/host/events/${id}/structure`);

  return (
    <div className="space-y-6 pt-2">
      <BackButton />
      <div>
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Step 2</p>
        <h1 className="text-2xl font-semibold">Structure</h1>
        <p className="text-mute text-sm mt-1">v1 defaults to 1 ring / 1 day.</p>
      </div>

      <ActionForm action={updateEventStructure.bind(null, event.id)} submitLabel="Save" className="space-y-3">
        <div>
          <label className="text-xs text-mute">Sport</label>
          <input name="sport" defaultValue={event.sport} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-mute">Rings</label>
            <input name="ringCount" type="number" min={1} defaultValue={event.ringCount} className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-mute">Days</label>
            <input name="dayCount" type="number" min={1} defaultValue={event.dayCount} className={inputClass} />
          </div>
        </div>
      </ActionForm>
    </div>
  );
}
