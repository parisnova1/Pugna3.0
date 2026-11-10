"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { voteFightOfDay } from "@/lib/actions/fightVote";

export type FightVoteRow = {
  boutId: string;
  label: string;
  detail: string;
  votes: number;
  share: number;
  leading: boolean;
};

export function FightVoteList({ rows, viewerBoutId }: { rows: FightVoteRow[]; viewerBoutId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function vote(boutId: string) {
    setError(null);
    setPendingId(boutId);
    startTransition(async () => {
      const result = await voteFightOfDay(boutId);
      if (!result.ok) setError(result.reason);
      router.refresh();
      setPendingId(null);
    });
  }

  return (
    <div className="mt-3 space-y-2">
      {rows.map((row) => {
        const mine = row.boutId === viewerBoutId;
        return (
          <div key={row.boutId} className={`rounded-md border px-3 py-2.5 ${mine ? "border-signal" : "border-white/10"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {row.label}
                  {row.leading && <span className="ml-2 text-[11px] font-semibold text-signal-ink">Leading</span>}
                </p>
                <p className="text-xs text-mute mt-0.5">{row.detail}</p>
              </div>
              <button
                type="button"
                disabled={pending || mine}
                aria-pressed={mine}
                aria-label={mine ? `Your vote: ${row.label}` : `Vote for ${row.label}`}
                onClick={() => vote(row.boutId)}
                className={`shrink-0 rounded-pill px-4 py-2 text-xs font-semibold disabled:opacity-100 ${
                  mine ? "bg-signal text-onsignal" : "border border-signal text-signal-ink"
                } ${pending && !mine ? "opacity-60" : ""}`}
              >
                {mine ? "Your vote" : pendingId === row.boutId ? "Voting…" : "Vote"}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-pill bg-white/10 overflow-hidden" aria-hidden="true">
                <div className="h-full rounded-pill bg-signal" style={{ width: `${row.share}%` }} />
              </div>
              <p className="text-xs text-mute tabular-nums w-16 text-right">
                {row.votes} · {row.share}%
              </p>
            </div>
          </div>
        );
      })}
      {error && (
        <p role="alert" className="text-xs text-error-ink">
          {error}
        </p>
      )}
    </div>
  );
}
