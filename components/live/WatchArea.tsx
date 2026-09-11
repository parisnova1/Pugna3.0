import type { BoutStatus } from "@prisma/client";

const HIDDEN: BoutStatus[] = ["SCRATCHED", "NO_SHOW"];

/**
 * The one Watch component reused everywhere a stream/recording link can show
 * (Live Fight hero, Event overview, Ring view, bout rows) — never an embedded
 * player, always a plain external link. `url` already carries the bout ->
 * event fallback resolution; this component only renders what it's given.
 */
export function WatchArea({
  url,
  status,
  size = "hero",
}: {
  url: string | null;
  status: BoutStatus;
  size?: "hero" | "compact";
}) {
  if (HIDDEN.includes(status)) return null;
  if (status === "FINAL" && !url) return null;

  const isLive = status === "IN_PROGRESS" && url;
  const isRecording = status === "FINAL" && url;
  const isIdle = !isLive && !isRecording;

  if (size === "compact") {
    if (!url || isIdle) return null;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-pill border border-signal/40 bg-signal/10 px-3 py-1.5 text-xs font-semibold text-signal"
      >
        <PlayIcon />
        {isLive ? "Watch live" : "Watch fight video"}
      </a>
    );
  }

  return (
    <div className="rounded-card bg-panel border border-white/10 p-5 text-center space-y-2">
      <p className="text-xs font-semibold text-mute uppercase tracking-wide">
        {isRecording ? "Fight video" : "Live stream"}
      </p>
      {isIdle ? (
        <>
          <p className="text-sm text-mute">
            {status === "DELAYED" ? "Stream will resume shortly." : "Stream link coming soon"}
          </p>
          <span className="inline-flex items-center gap-2 rounded-pill border border-white/15 px-4 py-2.5 text-sm font-medium text-mute">
            <span className="w-2 h-2 rounded-full border border-mute" />
            Watch when available
          </span>
        </>
      ) : (
        <a
          href={url!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm"
        >
          <PlayIcon /> Watch fight
        </a>
      )}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
