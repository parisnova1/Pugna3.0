"use client";

import { useState, useTransition } from "react";
import { nominateFighter } from "@/lib/actions/request";
import { formatEventDate } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

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
        <Modal title="Nominate Fighter" onClose={close} closeLabel="Cancel" compactClose>

          {done ? (
            <>
              <p className="text-sm text-mute">
                {selectedFighter?.name} nominated for {selectedEvent?.name} at {weightClass}.
              </p>
              <p className="text-xs text-success font-semibold">Pending — awaiting the organizer.</p>
              <Button onClick={close} text="sm" fullWidth>
                Done
              </Button>
            </>
          ) : (
            <>
              {error && <p className="text-signal text-sm">{error}</p>}

              {step === "event" && (
                <div className="space-y-3">
                  {events.length === 0 ? (
                    <EmptyState>No events to nominate into yet — join or get invited to one first.</EmptyState>
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
                  <Button
                    disabled={!eventId}
                    onClick={() => setStep("fighter")}
                    text="sm" fullWidth
                  >
                    Next
                  </Button>
                </div>
              )}

              {step === "fighter" && (
                <div className="space-y-3">
                  {fighters.length === 0 ? (
                    <EmptyState>No fighters on your roster yet — add one first.</EmptyState>
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
                  <Button
                    disabled={!fighterId || !weightClass}
                    onClick={() => setStep("review")}
                    text="sm" fullWidth
                  >
                    Next
                  </Button>
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
                  <Button
                    disabled={pending}
                    onClick={submit}
                    text="sm" fullWidth
                  >
                    {pending ? "…" : "Submit nomination"}
                  </Button>
                </div>
              )}
            </>
          )}

        </Modal>
      )}
    </>
  );
}
