"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BoutStatus, EventStatus, RoundPhase, ScratchReason } from "@prisma/client";
import { computeRingProjections } from "@/lib/projection";
import { formatTime } from "@/lib/format";
import { RoundTimer } from "@/components/live/RoundTimer";
import {
  startBout,
  finishBout,
  delayBout,
  scratchBout,
  noShowBout,
  startIntermission,
  endIntermission,
  setRingBreak,
  startRound,
  startRest,
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
  winnerId: string | null;
  ringId: string;
  totalRounds: number | null;
  roundDurationSec: number;
  restDurationSec: number;
  currentRound: number;
  roundPhase: RoundPhase | null;
  phaseEndsAt: Date | null;
};

export type ConsoleRing = {
  id: string;
  number: number;
  name: string | null;
  onBreak: boolean;
  breakUntil: Date | null;
};

type Sheet =
  | { type: "delay"; boutId: string }
  | { type: "scratch"; boutId: string }
  | { type: "noshow"; boutId: string }
  | { type: "result"; boutId: string }
  | { type: "intermission" }
  | { type: "break"; ringId: string }
  | null;

const TERMINAL: BoutStatus[] = ["FINAL", "SCRATCHED", "NO_SHOW"];

function ringLabel(ring: ConsoleRing) {
  return ring.name ?? `Ring ${ring.number}`;
}

function findRingLabel(rings: ConsoleRing[], ringId: string): string {
  const ring = rings.find((r) => r.id === ringId);
  return ring ? ringLabel(ring) : "";
}

function ringDotClass(label: string | null) {
  switch (label) {
    case "LIVE":
      return "bg-signal";
    case "DELAYED":
      return "bg-yellow-500";
    case "BREAK":
      return "bg-mute";
    default:
      return "bg-white/20";
  }
}

export function LiveConsole({
  eventId,
  eventStatus,
  intermissionUntil,
  rings,
  bouts,
}: {
  eventId: string;
  eventStatus: EventStatus;
  intermissionUntil: Date | null;
  rings: ConsoleRing[];
  bouts: ConsoleBout[];
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const ringProjections = useMemo(() => computeRingProjections(eventStatus, rings, bouts), [eventStatus, rings, bouts]);

  const [selectedRingId, setSelectedRingId] = useState<string | null>(null);
  const activeRingId =
    selectedRingId ??
    rings.find((r) => {
      const label = ringProjections.get(r.id)?.nowLabel;
      return label === "LIVE" || label === "DELAYED";
    })?.id ??
    rings[0]?.id ??
    null;

  const activeRing = rings.find((r) => r.id === activeRingId) ?? null;
  const activeProjection = activeRingId ? ringProjections.get(activeRingId) ?? null : null;
  const ringBouts = bouts.filter((b) => b.ringId === activeRingId);
  const now = ringBouts.find((b) => b.id === activeProjection?.now?.id) ?? null;
  const next = ringBouts.find((b) => b.id === activeProjection?.next?.id) ?? null;

  const allTerminal = bouts.length > 0 && bouts.every((b) => TERMINAL.includes(b.status));
  const attention = bouts.filter((b) => b.status === "DELAYED" || (b.status === "TBD" && !TERMINAL.includes(b.status)));

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

      {rings.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {rings.map((ring) => {
            const label = ringProjections.get(ring.id)?.nowLabel ?? null;
            return (
              <button
                key={ring.id}
                onClick={() => setSelectedRingId(ring.id)}
                className={[
                  "flex items-center gap-2 rounded-pill border px-4 py-2 text-sm font-medium whitespace-nowrap",
                  ring.id === activeRingId ? "border-signal bg-signal/10" : "border-white/15",
                ].join(" ")}
              >
                <span className={`w-2 h-2 rounded-full ${ringDotClass(label)}`} />
                {ringLabel(ring)}
              </button>
            );
          })}
        </div>
      )}

      {eventStatus === "INTERMISSION" ? (
        <div className="rounded-card bg-panel border border-white/10 p-5 space-y-3">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Intermission</p>
          <p className="text-sm text-mute">
            {intermissionUntil ? `Resuming at ${formatTime(intermissionUntil)}.` : "Resuming shortly."} Starting a bout is
            blocked event-wide.
          </p>
          <button
            disabled={pending}
            onClick={() => run(() => endIntermission(eventId))}
            className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-60"
          >
            End intermission
          </button>
        </div>
      ) : activeRing?.onBreak ? (
        <div className="rounded-card bg-panel border border-white/10 p-5 space-y-3">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">{ringLabel(activeRing)} · On break</p>
          <p className="text-sm text-mute">
            {activeRing.breakUntil ? `Resuming at ${formatTime(activeRing.breakUntil)}.` : "Resuming shortly."} Starting a
            bout on this ring is blocked. Other rings are unaffected.
          </p>
          <button
            disabled={pending}
            onClick={() => run(() => setRingBreak(activeRing.id, eventId, false))}
            className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-60"
          >
            Resume {ringLabel(activeRing)}
          </button>
        </div>
      ) : now ? (
        <div
          className={[
            "rounded-card border p-5 space-y-3",
            now.roundPhase === "ROUND"
              ? "bg-signal/10 border-signal/40"
              : now.roundPhase === "REST"
                ? "bg-panel border-white/20"
                : "bg-panel border-white/10",
          ].join(" ")}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-mute uppercase tracking-wide">
              {activeRing ? `${ringLabel(activeRing)} · ` : ""}Now · Bout {now.number} · {now.weightClass}
            </p>
            {now.roundPhase && now.phaseEndsAt && (
              <span
                className={[
                  "text-sm font-semibold tabular px-2 py-0.5 rounded-pill",
                  now.roundPhase === "ROUND" ? "bg-signal text-onsignal" : "bg-white/10 text-ink",
                ].join(" ")}
              >
                <RoundTimer phaseEndsAt={now.phaseEndsAt} />
              </span>
            )}
          </div>
          <p className="text-lg font-semibold">
            {now.fighterAName ?? "TBD"} <span className="text-mute font-normal">vs</span> {now.fighterBName ?? "TBD"}
          </p>
          {now.totalRounds && now.roundPhase && (
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">
              Round {now.currentRound} of {now.totalRounds}
              {now.roundPhase === "REST" ? " · Rest" : ""}
            </p>
          )}
          {now.status === "IN_PROGRESS" && now.roundPhase === "ROUND" ? (
            <button
              disabled={pending}
              onClick={() => run(() => startRest(now.id, eventId))}
              className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-60"
            >
              End round
            </button>
          ) : now.status === "IN_PROGRESS" && now.roundPhase === "REST" && now.totalRounds && now.currentRound < now.totalRounds ? (
            <button
              disabled={pending}
              onClick={() => run(() => startRound(now.id, eventId))}
              className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-60"
            >
              Start round {now.currentRound + 1}
            </button>
          ) : now.status === "IN_PROGRESS" ? (
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
          <p className="text-sm text-mute">{activeRing ? `No bout in progress on ${ringLabel(activeRing)}.` : "No bout in progress."}</p>
        </div>
      )}

      {eventStatus !== "INTERMISSION" && !activeRing?.onBreak && now?.status !== "IN_PROGRESS" && activeRing && (
        <div className="flex gap-2">
          <button
            disabled={pending}
            onClick={() => setSheet({ type: "break", ringId: activeRing.id })}
            className="flex-1 rounded-pill border border-white/20 text-ink font-semibold py-2 text-sm"
          >
            Break {ringLabel(activeRing)}
          </button>
          <button
            disabled={pending}
            onClick={() => setSheet({ type: "intermission" })}
            className="flex-1 rounded-pill border border-white/20 text-ink font-semibold py-2 text-sm"
          >
            Start intermission (all rings)
          </button>
        </div>
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
              Bout {b.number}
              {rings.length > 1 ? ` · ${findRingLabel(rings, b.ringId)}` : ""}:{" "}
              {b.status === "DELAYED" ? `Delayed +${b.delayMinutes ?? 0}` : "TBD opponent"}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Full card</p>
        {bouts.map((b) => {
          const isFinal = b.status === "FINAL";
          const winnerName = b.winnerId === b.fighterAId ? b.fighterAName : b.winnerId === b.fighterBId ? b.fighterBName : null;
          return (
            <div
              key={b.id}
              className={`flex items-center justify-between rounded-card border px-4 py-2 text-sm ${
                isFinal && winnerName ? "border-signal/20" : "border-white/10"
              }`}
            >
              <span>
                {b.number}.{" "}
                <span className={winnerName && winnerName === b.fighterAName ? "text-signal font-semibold" : ""}>
                  {b.fighterAName ?? "TBD"}
                </span>{" "}
                vs{" "}
                <span className={winnerName && winnerName === b.fighterBName ? "text-signal font-semibold" : ""}>
                  {b.fighterBName ?? "TBD"}
                </span>
                {rings.length > 1 ? <span className="text-mute"> · {findRingLabel(rings, b.ringId)}</span> : null}
              </span>
              <span className={`text-xs ${isFinal && winnerName ? "text-signal font-medium" : "text-mute"}`}>
                {isFinal && winnerName ? `${winnerName} won` : b.status}
              </span>
            </div>
          );
        })}
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

      {sheet?.type === "intermission" && (
        <Sheet onClose={() => setSheet(null)} title="Start intermission">
          <ResumeTimeForm
            pending={pending}
            submitLabel="Start intermission"
            onSubmit={(fd) => run(() => startIntermission(eventId, fd))}
          />
        </Sheet>
      )}

      {sheet?.type === "break" && (
        <Sheet onClose={() => setSheet(null)} title={`Break ${findRingLabel(rings, sheet.ringId)}`}>
          <ResumeTimeForm
            pending={pending}
            submitLabel="Start break"
            onSubmit={(fd) => run(() => setRingBreak(sheet.ringId, eventId, true, fd))}
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

function ResumeTimeForm({
  pending,
  submitLabel,
  onSubmit,
}: {
  pending: boolean;
  submitLabel: string;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <form action={(fd) => onSubmit(fd)} className="space-y-3">
      <div>
        <label className="text-xs text-mute">Resume time (optional)</label>
        <input
          name="resumeAt"
          type="time"
          className="w-full mt-1 rounded-card bg-void border border-white/10 px-4 py-3 text-sm"
        />
      </div>
      <button type="submit" disabled={pending} className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-60">
        {submitLabel}
      </button>
    </form>
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
