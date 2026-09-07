"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BoutStatus, EventStatus, ScratchReason } from "@prisma/client";
import { computeProjection } from "@/lib/projection";
import {
  startBout,
  finishBout,
  delayBout,
  scratchBout,
  noShowBout,
  startIntermission,
  endIntermission,
  finishEvent,
} from "@/lib/actions/live";

export type ConsoleBout = {
  id: string;
  number: number;
  weightClass: string;
  status: BoutStatus;
  delayMinutes: number | null;
  scratchReason: ScratchReason | null;
  fighterAId: string | null;
  fighterBId: string | null;
  fighterAName: string | null;
  fighterBName: string | null;
};

type Sheet =
  | { type: "delay"; boutId: string }
  | { type: "scratch"; boutId: string }
  | { type: "noshow"; boutId: string }
  | { type: "result"; boutId: string }
  | null;

const TERMINAL: BoutStatus[] = ["FINAL", "SCRATCHED", "NO_SHOW"];

export function LiveConsole({
  eventId,
  eventStatus,
  bouts,
}: {
  eventId: string;
  eventStatus: EventStatus;
  bouts: ConsoleBout[];
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const projection = computeProjection(eventStatus, bouts);
  const now = bouts.find((b) => b.id === projection.now?.id) ?? null;
  const next = bouts.find((b) => b.id === projection.next?.id) ?? null;
  const allTerminal = bouts.length > 0 && bouts.every((b) => TERMINAL.includes(b.status));
  const attention = bouts.filter(
    (b) => b.status === "DELAYED" || (b.status === "TBD" && !TERMINAL.includes(b.status)),
  );

  function run(action: () => Promise<{ ok: boolean; reason?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.reason ?? "Action failed.");
      else {
        setSheet(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Live console</h1>
        <span className="text-xs text-mute">Live on the public card</span>
      </div>

      {error && <p className="text-signal text-sm rounded-card border border-signal/40 bg-signal/5 p-3">{error}</p>}

      {eventStatus === "INTERMISSION" ? (
        <div className="rounded-card bg-panel border border-white/10 p-5 space-y-3">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Intermission</p>
          <p className="text-sm text-mute">Public card shows an estimate. Starting a bout is blocked.</p>
          <button
            disabled={pending}
            onClick={() => run(() => endIntermission(eventId))}
            className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-60"
          >
            End intermission
          </button>
        </div>
      ) : now ? (
        <div className="rounded-card bg-panel border border-white/10 p-5 space-y-3">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">
            Now · Bout {now.number} · {now.weightClass}
          </p>
          <p className="text-lg font-semibold">
            {now.fighterAName ?? "TBD"} <span className="text-mute font-normal">vs</span> {now.fighterBName ?? "TBD"}
          </p>
          {now.status === "IN_PROGRESS" ? (
            <button
              disabled={pending}
              onClick={() => setSheet({ type: "result", boutId: now.id })}
              className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-60"
            >
              Finish
            </button>
          ) : (
            <button
              disabled={pending}
              onClick={() => run(() => startBout(now.id, eventId))}
              className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-60"
            >
              Start
            </button>
          )}
          <div className="flex gap-2">
            <SmallButton onClick={() => setSheet({ type: "delay", boutId: now.id })}>Delay</SmallButton>
            <SmallButton onClick={() => setSheet({ type: "scratch", boutId: now.id })}>Scratch</SmallButton>
            <SmallButton onClick={() => setSheet({ type: "noshow", boutId: now.id })}>No-show</SmallButton>
          </div>
        </div>
      ) : (
        <div className="rounded-card bg-panel border border-white/10 p-5">
          <p className="text-sm text-mute">No bout in progress.</p>
        </div>
      )}

      {eventStatus !== "INTERMISSION" && now?.status !== "IN_PROGRESS" && (
        <button
          disabled={pending}
          onClick={() => run(() => startIntermission(eventId))}
          className="w-full rounded-pill border border-white/20 text-ink font-semibold py-2 text-sm"
        >
          Start intermission
        </button>
      )}

      {next && (
        <div className="rounded-card bg-panel border border-white/10 p-4">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide mb-1">
            Next · Bout {next.number}
          </p>
          <p className="text-sm">
            {next.fighterAName ?? "TBD"} <span className="text-mute">vs</span> {next.fighterBName ?? "TBD"}
          </p>
        </div>
      )}

      {attention.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Needs attention</p>
          {attention.map((b) => (
            <div key={b.id} className="rounded-card border border-white/10 px-4 py-2 text-sm">
              Bout {b.number}: {b.status === "DELAYED" ? `Delayed +${b.delayMinutes ?? 0}` : "TBD opponent"}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Full card</p>
        {bouts.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-card border border-white/10 px-4 py-2 text-sm">
            <span>
              {b.number}. {b.fighterAName ?? "TBD"} vs {b.fighterBName ?? "TBD"}
            </span>
            <span className="text-xs text-mute">{b.status}</span>
          </div>
        ))}
      </div>

      {allTerminal && (
        <button
          disabled={pending}
          onClick={() => run(() => finishEvent(eventId))}
          className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-60"
        >
          Finish event
        </button>
      )}

      {sheet?.type === "delay" && (
        <Sheet onClose={() => setSheet(null)} title="Delay">
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 15].map((m) => (
              <button
                key={m}
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("minutes", String(m));
                  run(() => delayBout(sheet.boutId, eventId, fd));
                }}
                className="rounded-card border border-white/15 py-3 text-sm font-medium"
              >
                +{m}m
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet?.type === "scratch" && (
        <Sheet onClose={() => setSheet(null)} title="Scratch">
          <div className="space-y-2">
            {(["INJURY", "WITHDRAWAL", "NO_OPPONENT", "ORGANIZER_DECISION", "OTHER"] as ScratchReason[]).map((reason) => (
              <button
                key={reason}
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("reason", reason);
                  run(() => scratchBout(sheet.boutId, eventId, fd));
                }}
                className="w-full rounded-card border border-white/15 py-3 text-sm font-medium text-left px-4"
              >
                {reason.replace("_", " ").toLowerCase()}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet?.type === "noshow" && (
        <Sheet onClose={() => setSheet(null)} title="No-show">
          <button
            disabled={pending}
            onClick={() => run(() => noShowBout(sheet.boutId, eventId))}
            className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-60"
          >
            Confirm no-show
          </button>
        </Sheet>
      )}

      {sheet?.type === "result" && (
        <Sheet onClose={() => setSheet(null)} title="Result">
          <ResultForm
            bout={bouts.find((b) => b.id === sheet.boutId)!}
            pending={pending}
            onSubmit={(fd) => run(() => finishBout(sheet.boutId, eventId, fd))}
          />
        </Sheet>
      )}
    </div>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex-1 rounded-pill border border-white/15 py-2 text-xs font-medium text-mute">
      {children}
    </button>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="glass relative w-full max-w-md rounded-t-card p-6 space-y-4">
        <h3 className="font-semibold">{title}</h3>
        {children}
        <button onClick={onClose} className="w-full rounded-pill border border-white/20 text-ink font-semibold py-2 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ResultForm({
  bout,
  pending,
  onSubmit,
}: {
  bout: ConsoleBout;
  pending: boolean;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <form
      action={(fd) => onSubmit(fd)}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-2">
        {bout.fighterAId && (
          <label className="flex items-center gap-2 rounded-card border border-white/15 px-3 py-2 text-sm">
            <input type="radio" name="winnerId" value={bout.fighterAId} /> {bout.fighterAName}
          </label>
        )}
        {bout.fighterBId && (
          <label className="flex items-center gap-2 rounded-card border border-white/15 px-3 py-2 text-sm">
            <input type="radio" name="winnerId" value={bout.fighterBId} /> {bout.fighterBName}
          </label>
        )}
      </div>
      <input
        name="method"
        placeholder="Method (e.g. Decision, KO)"
        required
        className="w-full rounded-card bg-void border border-white/10 px-4 py-3 text-sm"
      />
      <input
        name="round"
        type="number"
        placeholder="Round (optional)"
        className="w-full rounded-card bg-void border border-white/10 px-4 py-3 text-sm"
      />
      <button type="submit" disabled={pending} className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3">
        Confirm result
      </button>
    </form>
  );
}
