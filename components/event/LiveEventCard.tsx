"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BoutStatus, EventStatus, RoundPhase } from "@prisma/client";
import { formatTime } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { RoundTimer } from "@/components/live/RoundTimer";
import { FreshnessMeter } from "@/components/live/FreshnessMeter";
import { WatchArea } from "@/components/live/WatchArea";

export type BoutView = {
  id: string;
  number: number;
  weightClass: string;
  status: BoutStatus;
  delayMinutes: number | null;
  fighterAName: string | null;
  fighterBName: string | null;
  winnerName?: string | null;
  streamUrl?: string | null;
  totalRounds?: number | null;
  currentRound?: number;
  roundPhase?: RoundPhase | null;
  phaseEndsAt?: Date | null;
};

type ProjectionResponse = {
  status: EventStatus;
  nowLabel: "LIVE" | "DELAYED" | "UP_NEXT" | "INTERMISSION" | "BREAK" | null;
  intermissionUntil: string | null;
  breakUntil: string | null;
  now: {
    id: string;
    number: number;
    status: BoutStatus;
    delayMinutes: number | null;
    totalRounds: number | null;
    currentRound: number;
    roundPhase: RoundPhase | null;
    phaseEndsAt: string | null;
    streamUrl: string | null;
  } | null;
  next: { id: string; number: number; status: BoutStatus } | null;
  bouts: { id: string; number: number; status: BoutStatus; winnerName: string | null }[];
  followerCount: number;
  updatedAt: string;
};

const watchingLabel = (count: number) => `${new Intl.NumberFormat("en-US").format(count)} watching`;

const POLL_MS = 15000;
const LIVE_STATUSES: EventStatus[] = ["PUBLISHED", "LIVE", "INTERMISSION"];

function statusPillFor(
  status: EventStatus,
  nowLabel: ProjectionResponse["nowLabel"],
): { text: string; live: boolean } | null {
  if (status === "CANCELLED") return { text: "Cancelled", live: false };
  if (status === "FINISHED" || status === "ARCHIVED") return { text: "Finished", live: false };
  if (nowLabel === "LIVE") return { text: "Live", live: true };
  if (nowLabel === "INTERMISSION") return { text: "Intermission", live: false };
  if (nowLabel === "BREAK") return { text: "On break", live: false };
  if (status === "PUBLISHED") return { text: "Upcoming", live: false };
  if (status === "LIVE") return { text: "In progress", live: false };
  return null;
}

function statusLabel(bout: BoutView): string {
  switch (bout.status) {
    case "FINAL":
      return "Final";
    case "SCRATCHED":
      return "Scratched";
    case "NO_SHOW":
      return "No-show";
    case "IN_PROGRESS":
      return "Live";
    case "DELAYED":
      return bout.delayMinutes ? `Delayed +${bout.delayMinutes}` : "Delayed";
    case "READY":
    case "CONFIRMED":
      return "Scheduled";
    case "TBD":
      return "TBD opponent";
    default:
      return "Draft";
  }
}

export function LiveEventCard({
  slug,
  name,
  dateLabel,
  venueLabel,
  streamUrl,
  cancelReason,
  initialStatus,
  initialBouts,
  initialNowLabel,
  initialNowId,
  initialNextId,
  initialFollowerCount,
  initialIntermissionUntil,
  initialBreakUntil,
  ringId,
  ringName,
  coverUrl,
  galleryUrls,
  sponsorUrls,
}: {
  slug: string;
  name: string;
  dateLabel: string;
  venueLabel: string;
  streamUrl: string | null;
  cancelReason: string | null;
  initialStatus: EventStatus;
  initialBouts: BoutView[];
  initialNowLabel: ProjectionResponse["nowLabel"];
  initialNowId: string | null;
  initialNextId: string | null;
  initialFollowerCount: number;
  initialIntermissionUntil?: Date | null;
  initialBreakUntil?: Date | null;
  ringId?: string;
  ringName?: string;
  coverUrl?: string | null;
  galleryUrls?: string[];
  sponsorUrls?: string[];
}) {
  const [status, setStatus] = useState(initialStatus);
  const [bouts, setBouts] = useState(initialBouts);
  const [nowLabel, setNowLabel] = useState(initialNowLabel);
  const [nowId, setNowId] = useState(initialNowId);
  const [nextId, setNextId] = useState(initialNextId);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [intermissionUntil, setIntermissionUntil] = useState<Date | null>(initialIntermissionUntil ?? null);
  const [breakUntil, setBreakUntil] = useState<Date | null>(initialBreakUntil ?? null);
  const [nowRound, setNowRound] = useState<{
    totalRounds: number | null;
    currentRound: number;
    roundPhase: RoundPhase | null;
    phaseEndsAt: Date | null;
  } | null>(() => {
    const b = initialBouts.find((b) => b.id === initialNowId);
    return b ? { totalRounds: b.totalRounds ?? null, currentRound: b.currentRound ?? 0, roundPhase: b.roundPhase ?? null, phaseEndsAt: b.phaseEndsAt ?? null } : null;
  });
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());
  const [connectionLost, setConnectionLost] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const url = ringId ? `/api/events/${slug}/projection?ringId=${ringId}` : `/api/events/${slug}/projection`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const data: ProjectionResponse = await res.json();
        setStatus(data.status);
        setNowLabel(data.nowLabel);
        setNowId(data.now?.id ?? null);
        setNextId(data.next?.id ?? null);
        setFollowerCount(data.followerCount);
        setIntermissionUntil(data.intermissionUntil ? new Date(data.intermissionUntil) : null);
        setBreakUntil(data.breakUntil ? new Date(data.breakUntil) : null);
        setNowRound(
          data.now
            ? {
                totalRounds: data.now.totalRounds,
                currentRound: data.now.currentRound,
                roundPhase: data.now.roundPhase,
                phaseEndsAt: data.now.phaseEndsAt ? new Date(data.now.phaseEndsAt) : null,
              }
            : null,
        );
        setBouts((prev) =>
          prev.map((b) => {
            const match = data.bouts.find((d) => d.id === b.id);
            if (!match) return b;
            const isNow = data.now?.id === b.id;
            const delay = isNow ? data.now!.delayMinutes : null;
            const streamUrl = isNow ? data.now!.streamUrl : b.streamUrl;
            return { ...b, status: match.status, delayMinutes: delay, winnerName: match.winnerName, streamUrl };
          }),
        );
        setUpdatedAt(new Date(data.updatedAt));
        setConnectionLost(false);
      } catch {
        setConnectionLost(true);
      }
    }

    if (!LIVE_STATUSES.includes(status)) return;

    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, ringId, status === "FINISHED" || status === "ARCHIVED" || status === "CANCELLED"]);

  const now = bouts.find((b) => b.id === nowId) ?? null;
  const next = bouts.find((b) => b.id === nextId) ?? null;
  const isPolling = LIVE_STATUSES.includes(status);
  const pill = statusPillFor(status, nowLabel);

  return (
    <div className="space-y-6">
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="w-full aspect-video object-cover rounded-card" />
      )}
      <div>
        {pill && (
          <div className="flex items-center gap-2 mb-2">
            <Badge live={pill.live} tone={pill.live ? "signal" : "neutral"}>
              {pill.text}
            </Badge>
            {followerCount > 0 && <span className="text-[11px] text-mute tabular">{watchingLabel(followerCount)}</span>}
          </div>
        )}
        {ringName ? (
          <>
            <Link href={`/e/${slug}`} className="text-xs text-mute underline">
              {name}
            </Link>
            <h1 className="text-2xl font-semibold mt-0.5">{ringName}</h1>
          </>
        ) : (
          <h1 className="text-2xl font-semibold">{name}</h1>
        )}
        <p className="text-mute text-sm mt-1">
          {dateLabel} · {venueLabel}
        </p>
        {streamUrl && status !== "CANCELLED" && (
          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-signal mt-2 font-medium"
          >
            Watch stream ↗
          </a>
        )}
        {status === "CANCELLED" && cancelReason && (
          <p className="text-sm text-signal mt-2">Cancelled: {cancelReason}</p>
        )}
      </div>

      {isPolling && <FreshnessMeter updatedAt={updatedAt} connectionLost={connectionLost} />}

      {nowLabel === "INTERMISSION" ? (
        <div className="rounded-card bg-panel border border-white/10 p-5">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Now</p>
          <p className="mt-2 text-lg font-semibold">Intermission</p>
          <p className="text-sm text-mute mt-1">{intermissionUntil ? `Resuming at ${formatTime(intermissionUntil)}.` : "Resuming shortly."}</p>
        </div>
      ) : nowLabel === "BREAK" ? (
        <div className="rounded-card bg-panel border border-white/10 p-5">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Now</p>
          <p className="mt-2 text-lg font-semibold">On break</p>
          <p className="text-sm text-mute mt-1">
            This ring is paused. {breakUntil ? `Resuming at ${formatTime(breakUntil)}.` : "Resuming shortly."}
          </p>
        </div>
      ) : now ? (
        <BoutHero bout={now} slug={slug} label={nowLabel} round={nowRound} eventStreamUrl={streamUrl} />
      ) : (
        <div className="rounded-card bg-panel border border-white/10 p-5">
          <p className="text-sm text-mute">
            {status === "FINISHED" ? "Event finished." : "No bout in progress."}
          </p>
        </div>
      )}

      {next && (
        <div>
          <p className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Next</p>
          <BoutLink slug={slug} boutId={next.id} className="block rounded-card bg-panel border border-white/10 p-4">
            <p className="font-medium">
              {next.fighterAName ?? "TBD"} <span className="text-mute">vs</span> {next.fighterBName ?? "TBD"}
            </p>
            <p className="text-xs text-mute mt-1">
              Bout {next.number} · {statusLabel(next)}
            </p>
          </BoutLink>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Full card</p>
        <div className="space-y-2">
          {bouts.map((bout) => {
            const isFinal = bout.status === "FINAL";
            return (
              <BoutLink
                key={bout.id}
                slug={slug}
                boutId={bout.id}
                className={[
                  "flex items-center justify-between rounded-card border px-4 py-3",
                  bout.id === nowId
                    ? "border-signal/40 bg-signal/5"
                    : isFinal && bout.winnerName
                      ? "border-signal/20 bg-panel"
                      : "border-white/10 bg-panel",
                ].join(" ")}
              >
                <div>
                  <p className="text-sm font-medium">
                    <span className={bout.winnerName && bout.winnerName === bout.fighterAName ? "text-signal font-semibold" : ""}>
                      {bout.fighterAName ?? "TBD"}
                    </span>{" "}
                    <span className="text-mute">vs</span>{" "}
                    <span className={bout.winnerName && bout.winnerName === bout.fighterBName ? "text-signal font-semibold" : ""}>
                      {bout.fighterBName ?? "TBD"}
                    </span>
                  </p>
                  <p className="text-xs text-mute mt-0.5">
                    Bout {bout.number} · {bout.weightClass}
                  </p>
                </div>
                <span className={`text-xs shrink-0 ml-2 ${isFinal && bout.winnerName ? "text-signal font-medium" : "text-mute"}`}>
                  {isFinal && bout.winnerName ? `${bout.winnerName} won` : statusLabel(bout)}
                </span>
              </BoutLink>
            );
          })}
        </div>
      </div>

      {galleryUrls && galleryUrls.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Gallery</p>
          <div className="flex gap-2 overflow-x-auto">
            {galleryUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="h-28 w-28 object-cover rounded-card shrink-0" />
            ))}
          </div>
        </div>
      )}

      {sponsorUrls && sponsorUrls.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-white/10">
          {sponsorUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="h-8 w-auto object-contain opacity-80" />
          ))}
        </div>
      )}
    </div>
  );
}

/** Bout Detail only exists once an event has a public slug — plain, non-clickable in the (host-only) preview page. */
function BoutLink({
  slug,
  boutId,
  className,
  children,
}: {
  slug: string;
  boutId: string;
  className: string;
  children: React.ReactNode;
}) {
  if (!slug) return <div className={className}>{children}</div>;
  return (
    <Link href={`/e/${slug}/bout/${boutId}`} className={className}>
      {children}
    </Link>
  );
}

function BoutHero({
  bout,
  slug,
  label,
  round,
  eventStreamUrl,
}: {
  bout: BoutView;
  slug: string;
  label: ProjectionResponse["nowLabel"];
  round?: { totalRounds: number | null; currentRound: number; roundPhase: RoundPhase | null; phaseEndsAt: Date | null } | null;
  eventStreamUrl?: string | null;
}) {
  const isLive = label === "LIVE";
  const inRound = round?.roundPhase === "ROUND";
  const inRest = round?.roundPhase === "REST";
  return (
    <div
      className={[
        "rounded-card border p-5",
        inRound ? "bg-signal/10 border-signal/40" : inRest ? "bg-panel border-white/20" : "bg-panel border-white/10",
      ].join(" ")}
    >
      <BoutLink slug={slug} boutId={bout.id} className="block">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLive && <span className="live-pulse w-2 h-2 rounded-full bg-signal" />}
            <p className="text-xs font-semibold uppercase tracking-wide text-signal">
              {label === "LIVE" ? "Live now" : label === "DELAYED" ? statusLabel(bout) : "Up next"}
            </p>
          </div>
          {round?.roundPhase && round.phaseEndsAt && (
            <span
              className={[
                "text-sm font-semibold tabular px-2 py-0.5 rounded-pill",
                inRound ? "bg-signal text-onsignal" : "bg-white/10 text-ink",
              ].join(" ")}
            >
              <RoundTimer phaseEndsAt={round.phaseEndsAt} />
            </span>
          )}
        </div>
        <p className="mt-3 text-xl font-semibold">
          {bout.fighterAName ?? "TBD"} <span className="text-mute font-normal">vs</span> {bout.fighterBName ?? "TBD"}
        </p>
        <p className="text-sm text-mute mt-1">
          Bout {bout.number} · {bout.weightClass}
          {round?.totalRounds && round.roundPhase ? ` · Round ${round.currentRound} of ${round.totalRounds}${inRest ? " · Rest" : ""}` : ""}
        </p>
      </BoutLink>
      <div className="mt-3">
        <WatchArea url={bout.streamUrl ?? eventStreamUrl ?? null} status={bout.status} size="compact" />
      </div>
    </div>
  );
}
