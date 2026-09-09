import { requireHostEvent } from "@/lib/host-guard";
import { updateEventStructure, renameRing } from "@/lib/actions/event";
import { ActionForm } from "@/components/host/ActionForm";
import { Stepper } from "@/components/host/Stepper";
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
        <p className="text-mute text-sm mt-1">Set how many days and rings this tournament runs.</p>
      </div>

      <ActionForm action={updateEventStructure.bind(null, event.id)} submitLabel="Save" className="space-y-3">
        <div>
          <label className="text-xs text-mute">Sport</label>
          <input name="sport" defaultValue={event.sport} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stepper name="ringCount" label="Rings" defaultValue={event.ringCount} />
          <Stepper name="dayCount" label="Days" defaultValue={event.dayCount} />
        </div>
      </ActionForm>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Ring names</p>
        {event.rings.map((ring) => (
          <ActionForm
            key={ring.id}
            action={renameRing.bind(null, ring.id, event.id)}
            submitLabel="Save"
            variant="secondary"
            className="flex items-end gap-2 [&>button]:mt-0 [&>button]:w-auto [&>button]:px-4"
          >
            <input
              name="name"
              defaultValue={ring.name ?? ""}
              placeholder={`Ring ${ring.number}`}
              className={`${inputClass} flex-1`}
            />
          </ActionForm>
        ))}
      </div>
    </div>
  );
}
