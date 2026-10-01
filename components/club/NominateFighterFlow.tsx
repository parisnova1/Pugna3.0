"use client";

import { useState, useTransition } from "react";
import { nominateFighter } from "@/lib/actions/request";
import { formatEventDate } from "@/lib/format";

type EventOption = { id: string; name: string; date: Date };
type FighterOption = { id: string; name: string; weightClass: string | null };
type Step = "event" | "fighter" | "review";

const INPUT_CLASS = "w-full rounded-card bg-void border border-white/10 px-4 py-3 text-sm";

/** Select Event -> Select Fighter -> Review -> Submit, reusing the existing
 * `nominateFighter` action (already gated club.nominate: Owner/Admin/Coach).
 * Pass `eventId` to skip straight to the fighter step when launched from a
 * specific event's own context. */
export function NominateFighterFlow({
  clubId,
  events,
  fighters,
  eventId: presetEventId,
  triggerLabel = "Nominate Fighter",
  triggerClassName = "w-full rounded-pill bg-signal text-onsignal font-semibold py-3 text-sm",
}: {
  clubId: string;
  events: EventOption[];
  fighters: FighterOption[];
  eventId?: string;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(presetEventId ? "fighter" : "event");
  const [eventId, setEventId] = useState(presetEventId ?? "");
  const [fighterId, setFighterId] = useState("");
  const [weightClass, setWeightClass] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function reset() {
    setStep(presetEventId ? "fighter" : "event");
    setEventId(presetEventId ?? "");
    setFighterId("");
    setWeightClass("");
    setError(null);
    setDone(false);
  }

  function close() {
    setOpen(false);
    reset();
  }

  const selectedEvent = events.find((e) => e.id === eventId) ?? null;
  const selectedFighter = fighters.find((f) => f.id === fighterId) ?? null;

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("eventId", eventId);
    fd.set("clubId", clubId);
    fd.set("fighterId", fighterId);
    fd.set("weightClass", weightClass);
    startTransition(async () => {
      const result = await nominateFighter(fd);
      if (!result.ok) setError(result.reason);
      else setDone(true);
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={close} />
          <div className="glass relative w-full max-w-md rounded-t-card p-6 space-y-4">
            <h3 className="font-semibold">Nominate Fighter</h3>

            {done ? (
              <>
                <p className="text-sm text-mute">
                  {selectedFighter?.name} nominated for {selectedEvent?.name} at {weightClass}.
                </p>
                <p className="text-xs text-success font-semibold">Pending — awaiting the organizer.</p>
                <button onClick={close} className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 text-sm">
                  Done
                </button>
              </>
            ) : (
              <>
                {error && <p className="text-signal text-sm">{error}</p>}

                {step === "event" && (
                  <div className="space-y-3">
                    {events.length === 0 ? (
                      <p className="text-sm text-mute">No events to nominate into yet — join or get invited to one first.</p>
                    ) : (
                      <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={INPUT_CLASS}>
                        <option value="">Select event</option>
                        {events.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name} — {formatEventDate(e.date)}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      disabled={!eventId}
                      onClick={() => setStep("fighter")}
                      className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 text-sm disabled:opacity-60"
                    >
                      Next
                    </button>
                  </div>
                )}

                {step === "fighter" && (
                  <div className="space-y-3">
                    {fighters.length === 0 ? (
                      <p className="text-sm text-mute">No fighters on your roster yet — add one first.</p>
                    ) : (
                      <select value={fighterId} onChange={(e) => setFighterId(e.target.value)} className={INPUT_CLASS}>
                        <option value="">Select fighter</option>
                        {fighters.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                            {f.weightClass ? ` — ${f.weightClass}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      value={weightClass}
                      onChange={(e) => setWeightClass(e.target.value)}
                      placeholder="Weight class"
                      className={INPUT_CLASS}
                    />
                    <button
                      disabled={!fighterId || !weightClass}
                      onClick={() => setStep("review")}
                      className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 text-sm disabled:opacity-60"
                    >
                      Next
                    </button>
                  </div>
                )}

                {step === "review" && (
                  <div className="space-y-3">
                    <div className="rounded-card border border-white/10 p-4 space-y-1 text-sm">
                      <p>
                        <span className="text-mute">Event:</span> {selectedEvent?.name}
                      </p>
                      <p>
                        <span className="text-mute">Fighter:</span> {selectedFighter?.name}
                      </p>
                      <p>
                        <span className="text-mute">Weight class:</span> {weightClass}
                      </p>
                    </div>
                    <button
                      disabled={pending}
                      onClick={submit}
                      className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 text-sm disabled:opacity-60"
                    >
                      {pending ? "…" : "Submit nomination"}
                    </button>
                  </div>
                )}
              </>
            )}

            <button onClick={close} className="w-full rounded-pill border border-white/20 text-ink font-semibold py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
