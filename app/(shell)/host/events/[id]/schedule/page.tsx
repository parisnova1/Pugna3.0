import { requireHostEvent } from "@/lib/host-guard";
import { setBoutSchedule, markBoutReady } from "@/lib/actions/event";
import { BackButton } from "@/components/event/ContextBar";
import { formatTime } from "@/lib/format";

export default async function ScheduleStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireHostEvent(id, `/host/events/${id}/schedule`);

  return (
    <div className="space-y-6 pt-2">
      <BackButton />
      <div>
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Step 5</p>
        <h1 className="text-2xl font-semibold">Schedule</h1>
      </div>

      <div className="space-y-3">
        {event.bouts.length === 0 ? (
          <p className="text-sm text-mute">Add bouts in Pair first.</p>
        ) : (
          event.bouts.map((bout) => (
            <div key={bout.id} className="rounded-card bg-panel border border-white/10 p-4 space-y-2">
              <p className="text-sm font-medium">
                Bout {bout.number}: {bout.fighterA?.displayName ?? "TBD"} vs {bout.fighterB?.displayName ?? "TBD"}
              </p>
              <p className="text-xs text-mute">
                {bout.status} {bout.scheduledTime ? `· ${formatTime(bout.scheduledTime)}` : ""}
              </p>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await setBoutSchedule(bout.id, event.id, formData);
                }}
                className="flex gap-2"
              >
                <input
                  name="scheduledTime"
                  type="datetime-local"
                  defaultValue={bout.scheduledTime ? bout.scheduledTime.toISOString().slice(0, 16) : ""}
                  className="flex-1 rounded-card bg-void border border-white/10 px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-pill border border-white/20 px-4 text-sm font-medium">
                  Save
                </button>
              </form>
              {bout.status === "CONFIRMED" && (
                <form
                  action={async () => {
                    "use server";
                    await markBoutReady(bout.id, event.id);
                  }}
                >
                  <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-2 text-sm">
                    Mark ready
                  </button>
                </form>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
