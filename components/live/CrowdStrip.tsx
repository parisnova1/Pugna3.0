"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CrowdEmoji } from "@prisma/client";
import { toggleReaction, postShout } from "@/lib/actions/crowd";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const EMOJI: Record<CrowdEmoji, string> = {
  FIRE: "🔥",
  GLOVES: "🥊",
  CLAP: "👏",
  HEART: "❤️",
  SHOCK: "😮",
};

export type ReactionCount = { emoji: CrowdEmoji; count: number };
export type Shout = { id: string; text: string; createdAt: string };

export function CrowdStrip({
  boutId,
  slug,
  isGuest,
  checkedIn,
  canWrite,
  frozen,
  reactionCounts,
  myReactions,
  shouts,
  crowdSize,
  onOptimisticReaction,
  onOptimisticShout,
}: {
  boutId: string;
  slug: string;
  isGuest: boolean;
  checkedIn: boolean;
  canWrite: boolean;
  frozen: boolean;
  reactionCounts: ReactionCount[];
  myReactions: CrowdEmoji[];
  shouts: Shout[];
  crowdSize: number;
  onOptimisticReaction: (emoji: CrowdEmoji) => void;
  onOptimisticShout: (text: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [viewAll, setViewAll] = useState(false);

  const topReactions = reactionCounts.filter((r) => r.count > 0).slice(0, 3);

  function react(emoji: CrowdEmoji) {
    if (!canWrite || pending) return;
    onOptimisticReaction(emoji);
    startTransition(async () => {
      await toggleReaction(boutId, emoji);
    });
  }

  function submitShout(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 60) return;
    setError(null);
    onOptimisticShout(trimmed);
    setText("");
    startTransition(async () => {
      const result = await postShout(boutId, (() => {
        const fd = new FormData();
        fd.set("text", trimmed);
        return fd;
      })());
      if (!result.ok) setError(result.reason);
    });
  }

  return (
    <div className="space-y-3 pt-2 border-t border-white/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">
          {frozen ? "Fight reaction" : `Live crowd${crowdSize > 0 ? ` · ${crowdSize}` : ""}`}
        </p>
        {(shouts.length > 0 || topReactions.length > 0) && (
          <button onClick={() => setViewAll(true)} className="text-xs text-signal font-medium">
            View all →
          </button>
        )}
      </div>

      {topReactions.length > 0 && (
        <div className="flex items-center gap-4">
          {topReactions.map((r) => (
            <span key={r.emoji} className="text-sm font-medium tabular">
              {EMOJI[r.emoji]} {r.count}
            </span>
          ))}
        </div>
      )}

      {shouts.length > 0 && (
        <div className="space-y-1">
          {shouts.slice(0, 2).map((s) => (
            <p key={s.id} className="text-sm text-mute truncate">
              &ldquo;{s.text}&rdquo;
            </p>
          ))}
        </div>
      )}

      {frozen ? null : !checkedIn || !canWrite ? (
        <div className="rounded-card border border-white/10 bg-panel px-4 py-3 space-y-2">
          <p className="text-sm font-medium">💬 Commenting is locked</p>
          <p className="text-xs text-mute">
            {isGuest
              ? "Sign in and check in at the event to join the crowd."
              : "You're watching from home. Check in at the event to join the crowd."}
          </p>
          <Button
            onClick={() =>
              isGuest
                ? router.push(`/account?returnTo=${encodeURIComponent(`/e/${slug}/check-in`)}`)
                : router.push(`/e/${slug}/check-in`)
            }
            size="xs" text="xs" className="px-4"
          >
            Check in
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">💬 Join the crowd</p>
          <div className="flex gap-2">
            {(Object.keys(EMOJI) as CrowdEmoji[]).map((emoji) => (
              <button
                key={emoji}
                onClick={() => react(emoji)}
                disabled={pending}
                className={[
                  "flex-1 rounded-pill border py-2 text-lg disabled:opacity-60",
                  myReactions.includes(emoji) ? "border-signal bg-signal/10" : "border-white/15",
                ].join(" ")}
              >
                {EMOJI[emoji]}
              </button>
            ))}
          </div>
          <form onSubmit={submitShout} className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 60))}
              maxLength={60}
              placeholder="Say something…"
              className="flex-1 rounded-card bg-void border border-white/10 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={pending || !text.trim()}
              className="rounded-pill bg-signal text-onsignal text-sm font-semibold px-4 disabled:opacity-60"
            >
              Send
            </button>
          </form>
          {error && <p className="text-xs text-signal">{error}</p>}
        </div>
      )}

      {viewAll && (
        <Modal title={frozen ? "Fight reaction" : "Live crowd"} onClose={() => setViewAll(false)} scrollable>
          <div className="flex flex-wrap gap-3">
            {reactionCounts
              .filter((r) => r.count > 0)
              .map((r) => (
                <span key={r.emoji} className="text-sm font-medium tabular">
                  {EMOJI[r.emoji]} {r.count}
                </span>
              ))}
          </div>
          <div className="space-y-2">
            {shouts.length === 0 ? (
              <EmptyState>No shouts yet.</EmptyState>
            ) : (
              shouts.map((s) => (
                <p key={s.id} className="text-sm border-b border-white/5 pb-2">
                  &ldquo;{s.text}&rdquo;
                </p>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
