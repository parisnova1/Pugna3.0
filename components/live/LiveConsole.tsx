"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
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
  setRingsBreak,
  postAnnouncement,
  startRound,
  startRest,
  finishEvent,
} from "@/lib/actions/live";
import { setBoutStreamUrl, cancelEvent } from "@/lib/actions/event";

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
  streamUrl: string | null;
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
  | { type: "link"; boutId: string }
  | { type: "announcement" }
  | { type: "cancel" }
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
      return "bg-live";
    case "DELAYED":
      return "bg-warning";
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
  slug,
}: {
  eventId: string;
  eventStatus: EventStatus;
  intermissionUntil: Date | null;
  rings: ConsoleRing[];
  bouts: ConsoleBout[];
  slug: string | null;
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">PUGNA Event Control</h1>
        {slug && (
          <Link
            href={`/e/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-pill border border-white/20 px-3 py-1.5 text-xs font-semibold text-ink"
          >
            Public view →
          </Link>
        )}
      </div>

      {error && <p className="text-signal text-sm rounded-card border border-signal/40 bg-signal/5 p-3">{error}</p>}

      <CustomTimer />

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
              ? "bg-live/10 border-live/40"
              : now.roundPhase === "REST"
                ? "bg-panel border-white/20"
                : "bg-panel border-white/10",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-xs font-semibold text-mute uppercase tracking-wide truncate">
                {activeRing ? `${ringLabel(activeRing)} · ` : ""}Now · Bout {now.number} · {now.weightClass}
              </p>
              <button
                onClick={() => setSheet({ type: "link", boutId: now.id })}
                className="text-xs font-medium text-mute underline shrink-0"
              >
                {now.streamUrl ? "Edit link" : "Watch link"}
              </button>
            </div>
            {now.roundPhase && now.phaseEndsAt && (
              <span
                className={[
                  "text-sm font-semibold tabular px-2 py-0.5 rounded-pill",
                  now.roundPhase === "ROUND" ? "bg-live text-onsignal" : "bg-white/10 text-ink",
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

      <div className="rounded-card border border-white/10 p-4 space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Event control</p>
        <div className="grid grid-cols-2 gap-2">
          {eventStatus === "INTERMISSION" ? (
            <button
              disabled={pending}
              onClick={() => run(() => endIntermission(eventId))}
              className="rounded-pill bg-signal text-onsignal font-semibold py-2.5 text-sm disabled:opacity-60"
            >
              Resume all rings
            </button>
          ) : (
            <button
              disabled={pending}
              onClick={() => setSheet({ type: "intermission" })}
              className="rounded-pill border border-white/20 text-ink font-semibold py-2.5 text-sm"
            >
              Pause all rings
            </button>
          )}
          <button
            disabled={pending}
            onClick={() => setSheet({ type: "announcement" })}
            className="rounded-pill border border-white/20 text-ink font-semibold py-2.5 text-sm"
          >
            Announcement
          </button>
        </div>
        <button
          disabled={pending}
          onClick={() => setSheet({ type: "cancel" })}
          className="w-full rounded-pill border border-error/40 text-error font-semibold py-2.5 text-sm"
        >
          Cancel event
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Full card</p>
        {bouts.map((b) => {
          const isFinal = b.status === "FINAL";
          const winnerName = b.winnerId === b.fighterAId ? b.fighterAName : b.winnerId === b.fighterBId ? b.fighterBName : null;
          return (
            <div
              key={b.id}
              className={`flex items-center justify-between rounded-card border px-4 py-2 text-sm ${
                isFinal && winnerName ? "border-success/20" : "border-white/10"
              }`}
            >
              <span>
                {b.number}.{" "}
                <span className={winnerName && winnerName === b.fighterAName ? "text-success font-semibold" : ""}>
                  {b.fighterAName ?? "TBD"}
                </span>{" "}
                vs{" "}
                <span className={winnerName && winnerName === b.fighterBName ? "text-success font-semibold" : ""}>
                  {b.fighterBName ?? "TBD"}
                </span>
                {rings.length > 1 ? <span className="text-mute"> · {findRingLabel(rings, b.ringId)}</span> : null}
              </span>
              <span className={`text-xs ${isFinal && winnerName ? "text-success font-medium" : "text-mute"}`}>
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

      {sheet?.type === "link" && (
        <Sheet onClose={() => setSheet(null)} title="Fight link">
          <LinkForm
            pending={pending}
            defaultValue={bouts.find((b) => b.id === sheet.boutId)?.streamUrl ?? ""}
            onSubmit={(fd) => run(() => setBoutStreamUrl(sheet.boutId, eventId, fd))}
          />
        </Sheet>
      )}

      {sheet?.type === "break" && (
        <Sheet onClose={() => setSheet(null)} title="Start break">
          <BreakForm
            rings={rings}
            defaultRingId={sheet.ringId}
            pending={pending}
            onSubmit={(ringIds, fd) => run(() => setRingsBreak(eventId, ringIds, true, fd))}
          />
        </Sheet>
      )}

      {sheet?.type === "announcement" && (
        <Sheet onClose={() => setSheet(null)} title="Announcement">
          <AnnouncementForm pending={pending} onSubmit={(fd) => run(() => postAnnouncement(eventId, fd))} />
        </Sheet>
      )}

      {sheet?.type === "cancel" && (
        <Sheet onClose={() => setSheet(null)} title="Cancel event">
          <CancelEventForm pending={pending} onSubmit={(fd) => run(() => cancelEvent(eventId, fd))} />
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

function LinkForm({
  pending,
  defaultValue,
  onSubmit,
}: {
  pending: boolean;
  defaultValue: string;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <form action={(fd) => onSubmit(fd)} className="space-y-3">
      <div>
        <label className="text-xs text-mute">Stream or recording URL</label>
        <input
          name="streamUrl"
          type="url"
          defaultValue={defaultValue}
          placeholder="https://..."
          className="w-full mt-1 rounded-card bg-void border border-white/10 px-4 py-3 text-sm"
        />
      </div>
      <p className="text-[11px] text-mute">Until you add a link, viewers see &ldquo;Stream link coming soon.&rdquo;</p>
      <button type="submit" disabled={pending} className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-60">
        Save link
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

const BREAK_REASONS = ["Lunch", "Medical", "Technical", "Officials", "Schedule Adjustment", "Other"] as const;

function BreakForm({
  rings,
  defaultRingId,
  pending,
  onSubmit,
}: {
  rings: ConsoleRing[];
  defaultRingId: string;
  pending: boolean;
  onSubmit: (ringIds: string[], fd: FormData) => void;
}) {
  const [reason, setReason] = useState<string>(BREAK_REASONS[0]);
  const [minutes, setMinutes] = useState(15);
  const [selectedRingIds, setSelectedRingIds] = useState<string[]>([defaultRingId]);

  function toggleRing(ringId: string) {
    setSelectedRingIds((ids) => (ids.includes(ringId) ? ids.filter((id) => id !== ringId) : [...ids, ringId]));
  }

  return (
    <form
      action={() => {
        const fd = new FormData();
        fd.set("reason", reason);
        fd.set("minutes", String(minutes));
        onSubmit(selectedRingIds, fd);
      }}
      className="space-y-4"
    >
      <div>
        <label className="text-xs text-mute">Reason</label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {BREAK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={[
                "rounded-card border py-2.5 text-sm font-medium",
                reason === r ? "border-signal bg-signal/10 text-ink" : "border-white/15 text-mute",
              ].join(" ")}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-mute">Duration</label>
        <div className="flex items-center gap-3 mt-1">
          <button
            type="button"
            onClick={() => setMinutes((m) => Math.max(5, m - 5))}
            className="rounded-full border border-white/20 w-9 h-9 text-lg font-semibold"
          >
            −
          </button>
          <span className="flex-1 text-center text-sm font-semibold tabular">{minutes} min</span>
          <button
            type="button"
            onClick={() => setMinutes((m) => m + 5)}
            className="rounded-full border border-white/20 w-9 h-9 text-lg font-semibold"
          >
            +
          </button>
        </div>
      </div>

      {rings.length > 1 && (
        <div>
          <label className="text-xs text-mute">Affected rings</label>
          <div className="space-y-1.5 mt-1">
            {rings.map((ring) => (
              <label key={ring.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selectedRingIds.includes(ring.id)} onChange={() => toggleRing(ring.id)} />
                {ringLabel(ring)}
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={pending || selectedRingIds.length === 0}
        className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-60"
      >
        Start break
      </button>
    </form>
  );
}

function AnnouncementForm({ pending, onSubmit }: { pending: boolean; onSubmit: (fd: FormData) => void }) {
  return (
    <form action={(fd) => onSubmit(fd)} className="space-y-3">
      <textarea
        name="message"
        required
        rows={3}
        placeholder="e.g. Doors close at 7pm — please take your seats."
        className="w-full rounded-card bg-void border border-white/10 px-4 py-3 text-sm resize-none"
      />
      <p className="text-[11px] text-mute">Sent as a notification to everyone following this event.</p>
      <button type="submit" disabled={pending} className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 disabled:opacity-60">
        Post announcement
      </button>
    </form>
  );
}

function CancelEventForm({ pending, onSubmit }: { pending: boolean; onSubmit: (fd: FormData) => void }) {
  return (
    <form action={(fd) => onSubmit(fd)} className="space-y-3">
      <p className="text-sm text-mute">This cancels the whole event and notifies everyone involved. This can&apos;t be undone.</p>
      <input
        name="reason"
        placeholder="Reason"
        className="w-full rounded-card bg-void border border-white/10 px-4 py-3 text-sm"
      />
      <button type="submit" disabled={pending} className="w-full rounded-pill bg-error text-ink font-semibold py-3 disabled:opacity-60">
        Confirm cancel event
      </button>
    </form>
  );
}

/** Organizer-local only — a plain countdown for warm-ups, ring prep, weigh-ins,
 * ceremonies. Never touches the network: not persisted, not shown to
 * spectators, resets if the page reloads. */
function CustomTimer() {
  const [open, setOpen] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(5 * 60);
  const [remaining, setRemaining] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function start() {
    setRemaining(totalSeconds);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r === null || r <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  function reset() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRemaining(null);
  }

  const mm = remaining !== null ? String(Math.floor(remaining / 60)).padStart(2, "0") : null;
  const ss = remaining !== null ? String(remaining % 60).padStart(2, "0") : null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-card border border-white/10 py-2 text-xs font-medium text-mute"
      >
        + Custom timer (warm-up, weigh-in, ceremony)
      </button>
    );
  }

  return (
    <div className="rounded-card border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Custom timer</p>
        <button onClick={() => setOpen(false)} className="text-xs text-mute underline">
          Hide
        </button>
      </div>
      {remaining !== null ? (
        <p className="text-3xl font-bold tabular text-center">
          {mm}:{ss}
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTotalSeconds((s) => Math.max(60, s - 60))}
            className="rounded-full border border-white/20 w-9 h-9 text-lg font-semibold"
          >
            −
          </button>
          <span className="flex-1 text-center text-sm font-semibold tabular">{Math.round(totalSeconds / 60)} min</span>
          <button onClick={() => setTotalSeconds((s) => s + 60)} className="rounded-full border border-white/20 w-9 h-9 text-lg font-semibold">
            +
          </button>
        </div>
      )}
      <div className="flex gap-2">
        {remaining === null ? (
          <button onClick={start} className="flex-1 rounded-pill bg-signal text-onsignal font-semibold py-2.5 text-sm">
            Start
          </button>
        ) : (
          <button onClick={reset} className="flex-1 rounded-pill border border-white/20 text-ink font-semibold py-2.5 text-sm">
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
