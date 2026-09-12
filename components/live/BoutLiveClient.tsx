"use client";

import { useEffect, useRef, useState } from "react";
import type { BoutStatus, CrowdEmoji, RoundPhase } from "@prisma/client";
import { Badge } from "@/components/ui/Badge";
import { RoundTimer } from "@/components/live/RoundTimer";
import { WatchArea } from "@/components/live/WatchArea";
import { FreshnessMeter } from "@/components/live/FreshnessMeter";
import { CrowdStrip, type ReactionCount, type Shout } from "@/components/live/CrowdStrip";

const POLL_MS = 15000;
const TERMINAL: BoutStatus[] = ["FINAL", "SCRATCHED", "NO_SHOW"];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  TBD: "Opponent TBD",
  CONFIRMED: "Confirmed",
  READY: "Scheduled",
  DELAYED: "Delayed",
  IN_PROGRESS: "Live",
  FINAL: "Final",
  SCRATCHED: "Scratched",
  NO_SHOW: "No-show",
};

type LiveResponse = {
  status: BoutStatus;
  delayMinutes: number | null;
  streamUrl: string | null;
  eventStreamUrl: string | null;
  totalRounds: number | null;
  currentRound: number;
  roundPhase: RoundPhase | null;
  phaseEndsAt: string | null;
  result: { winnerId: string | null; method: string; round: number | null } | null;
  reactionCounts: ReactionCount[];
  shouts: Shout[];
  crowdSize: number;
  myReactions: CrowdEmoji[];
  checkedIn: boolean;
  canWrite: boolean;
  followerCount: number;
  updatedAt: string;
};

export function BoutLiveClient({
  boutId,
  slug,
  isGuest,
  number,
  weightClass,
  fighterAId,
  fighterBId,
  fighterAName,
  fighterBName,
  fighterAClub,
  fighterBClub,
  initial,
}: {
  boutId: string;
  slug: string;
  isGuest: boolean;
  number: number;
  weightClass: string;
  fighterAId: string | null;
  fighterBId: string | null;
  fighterAName: string;
  fighterBName: string;
  fighterAClub: string | null;
  fighterBClub: string | null;
  initial: LiveResponse;
}) {
  const [data, setData] = useState<LiveResponse>(initial);
  const [updatedAt, setUpdatedAt] = useState(new Date(initial.updatedAt));
  const [connectionLost, setConnectionLost] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`/api/bouts/${boutId}/live`, { cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const next: LiveResponse = await res.json();
        setData(next);
        setUpdatedAt(new Date(next.updatedAt));
        setConnectionLost(false);
      } catch {
        setConnectionLost(true);
      }
    }

    if (TERMINAL.includes(data.status)) return;

    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boutId, TERMINAL.includes(data.status)]);

  const isPolling = !TERMINAL.includes(data.status);
  const isLive = data.status === "IN_PROGRESS";
  const inRound = data.roundPhase === "ROUND";
  const showCrowd = data.status === "IN_PROGRESS" || data.status === "DELAYED" || data.status === "FINAL";
  const winnerName =
    data.result?.winnerId === fighterAId ? fighterAName : data.result?.winnerId === fighterBId ? fighterBName : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge live={isLive} tone={isLive ? "live" : "neutral"}>
            {isLive
              ? "Live"
              : data.status === "DELAYED"
                ? `Delayed${data.delayMinutes ? ` +${data.delayMinutes}` : ""}`
                : STATUS_LABEL[data.status]}
          </Badge>
          <p className="text-xs text-mute">
            Bout {number} · {weightClass}
          </p>
        </div>
        {data.followerCount > 0 && (
          <p className="text-xs text-mute tabular">{new Intl.NumberFormat("en-US").format(data.followerCount)} watching</p>
        )}
      </div>

      <WatchArea url={data.streamUrl ?? data.eventStreamUrl} status={data.status} size="hero" />

      <div className="rounded-card bg-panel border border-white/10 p-6 space-y-4">
        <FighterRow name={fighterAName} club={fighterAClub} isWinner={Boolean(winnerName && winnerName === fighterAName)} />
        <div className="text-center text-mute text-sm">vs</div>
        <FighterRow name={fighterBName} club={fighterBClub} isWinner={Boolean(winnerName && winnerName === fighterBName)} />
      </div>

      {data.totalRounds && data.roundPhase && data.phaseEndsAt && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wide text-mute">
            Round {data.currentRound} of {data.totalRounds}
            {data.roundPhase === "REST" ? " · Rest" : ""}
          </span>
          <span
            className={[
              "text-sm font-semibold tabular px-2 py-0.5 rounded-pill",
              inRound ? "bg-live text-onsignal" : "bg-white/10 text-ink",
            ].join(" ")}
          >
            <RoundTimer phaseEndsAt={new Date(data.phaseEndsAt)} />
          </span>
        </div>
      )}

      {data.status === "FINAL" && data.result && (
        <div className={`rounded-card bg-panel border p-4 ${winnerName ? "border-success/30" : "border-white/10"}`}>
          <p className="text-xs font-semibold text-mute uppercase tracking-wide mb-1">Result</p>
          <p className={`text-sm font-semibold ${winnerName ? "text-success" : "text-ink"}`}>{winnerName ? `${winnerName} won` : "Draw"}</p>
          <p className="text-sm text-mute mt-0.5">
            {data.result.method}
            {data.result.round ? ` · Round ${data.result.round}` : ""}
          </p>
        </div>
      )}

      {isPolling && <FreshnessMeter updatedAt={updatedAt} connectionLost={connectionLost} />}

      {showCrowd && (
        <CrowdStrip
          boutId={boutId}
          slug={slug}
          isGuest={isGuest}
          checkedIn={data.checkedIn}
          canWrite={data.canWrite}
          frozen={data.status === "FINAL"}
          reactionCounts={data.reactionCounts}
          myReactions={data.myReactions}
          shouts={data.shouts}
          crowdSize={data.crowdSize}
          onOptimisticReaction={(emoji) =>
            setData((prev) => {
              const has = prev.myReactions.includes(emoji);
              return {
                ...prev,
                myReactions: has ? prev.myReactions.filter((e) => e !== emoji) : [...prev.myReactions, emoji],
                reactionCounts: prev.reactionCounts.some((r) => r.emoji === emoji)
                  ? prev.reactionCounts.map((r) => (r.emoji === emoji ? { ...r, count: r.count + (has ? -1 : 1) } : r))
                  : [...prev.reactionCounts, { emoji, count: 1 }],
              };
            })
          }
          onOptimisticShout={(text) =>
            setData((prev) => ({
              ...prev,
              shouts: [{ id: `optimistic-${Date.now()}`, text, createdAt: new Date().toISOString() }, ...prev.shouts].slice(0, 5),
            }))
          }
        />
      )}
    </div>
  );
}

function FighterRow({ name, club, isWinner }: { name: string; club: string | null; isWinner: boolean }) {
  return (
    <div className={`text-center rounded-card py-1.5 ${isWinner ? "bg-success/10 border border-success/30" : ""}`}>
      <div className="flex items-center justify-center gap-1.5">
        <p className={`font-semibold ${isWinner ? "text-success" : ""}`}>{name}</p>
        {isWinner && <Badge tone="success">Winner</Badge>}
      </div>
      <p className="text-xs text-mute mt-0.5">{club ?? "Guest"}</p>
    </div>
  );
}
