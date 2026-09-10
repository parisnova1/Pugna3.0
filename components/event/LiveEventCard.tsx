"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BoutStatus, EventStatus } from "@prisma/client";
import { formatUpdatedAt } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";

export type BoutView = {
  id: string;
  number: number;
  weightClass: string;
  status: BoutStatus;
  delayMinutes: number | null;
  fighterAName: string | null;
  fighterBName: string | null;
};

type ProjectionResponse = {
  status: EventStatus;
  nowLabel: "LIVE" | "DELAYED" | "UP_NEXT" | "INTERMISSION" | "BREAK" | null;
  now: { id: string; number: number; status: BoutStatus; delayMinutes: number | null } | null;
  next: { id: string; number: number; status: BoutStatus } | null;
  bouts: { id: string; number: number; status: BoutStatus }[];
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
        setBouts((prev) =>
          prev.map((b) => {
            const match = data.bouts.find((d) => d.id === b.id);
            if (!match) return b;
            const delay = data.now?.id === b.id ? data.now.delayMinutes : null;
            return { ...b, status: match.status, delayMinutes: delay };
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

      {isPolling && (
        <p className="text-[11px] text-mute tabular">
          {connectionLost ? (
            <>Connection lost · Showing last update {formatUpdatedAt(updatedAt)} · Retrying…</>
          ) : (
            <>Updated {formatUpdatedAt(updatedAt)}</>
          )}
        </p>
      )}

      {nowLabel === "INTERMISSION" ? (
        <div className="rounded-card bg-panel border border-white/10 p-5">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Now</p>
          <p className="mt-2 text-lg font-semibold">Intermission</p>
          <p className="text-sm text-mute mt-1">Resuming shortly.</p>
        </div>
      ) : nowLabel === "BREAK" ? (
        <div className="rounded-card bg-panel border border-white/10 p-5">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Now</p>
          <p className="mt-2 text-lg font-semibold">On break</p>
          <p className="text-sm text-mute mt-1">This ring is paused. Resuming shortly.</p>
        </div>
      ) : now ? (
        <BoutHero bout={now} slug={slug} label={nowLabel} />
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
          {bouts.map((bout) => (
            <BoutLink
              key={bout.id}
              slug={slug}
              boutId={bout.id}
              className={[
                "flex items-center justify-between rounded-card border px-4 py-3",
                bout.id === nowId ? "border-signal/40 bg-signal/5" : "border-white/10 bg-panel",
              ].join(" ")}
            >
              <div>
                <p className="text-sm font-medium">
                  {bout.fighterAName ?? "TBD"} <span className="text-mute">vs</span> {bout.fighterBName ?? "TBD"}
                </p>
                <p className="text-xs text-mute mt-0.5">
                  Bout {bout.number} · {bout.weightClass}
                </p>
              </div>
              <span className="text-xs text-mute shrink-0 ml-2">{statusLabel(bout)}</span>
            </BoutLink>
          ))}
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
}: {
  bout: BoutView;
  slug: string;
  label: ProjectionResponse["nowLabel"];
}) {
  const isLive = label === "LIVE";
  return (
    <BoutLink slug={slug} boutId={bout.id} className="block rounded-card bg-panel border border-white/10 p-5">
      <div className="flex items-center gap-2">
        {isLive && <span className="live-pulse w-2 h-2 rounded-full bg-signal" />}
        <p className="text-xs font-semibold uppercase tracking-wide text-signal">
          {label === "LIVE" ? "Live now" : label === "DELAYED" ? statusLabel(bout) : "Up next"}
        </p>
      </div>
      <p className="mt-3 text-xl font-semibold">
        {bout.fighterAName ?? "TBD"} <span className="text-mute font-normal">vs</span> {bout.fighterBName ?? "TBD"}
      </p>
      <p className="text-sm text-mute mt-1">
        Bout {bout.number} · {bout.weightClass}
      </p>
    </BoutLink>
  );
}
