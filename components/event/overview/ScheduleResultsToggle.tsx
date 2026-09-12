"use client";

import { useState, type ReactNode } from "react";

type Mode = "schedule" | "results";

/**
 * Instant Schedule/Results switch for a tournament day — no scrolling, no
 * route change. Both panels are server-rendered by the page and handed in
 * as children slots, so no bout data crosses the client boundary and
 * nothing is duplicated between the two modes.
 */
export function ScheduleResultsToggle({
  resultsCount,
  schedule,
  results,
}: {
  resultsCount: number;
  schedule: ReactNode;
  results: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>("schedule");

  return (
    <div>
      <div className="sticky top-0 z-30 -mx-4 px-4 py-2 glass">
        <div className="flex rounded-pill border border-white/15 p-1 gap-1">
          <button
            type="button"
            onClick={() => setMode("schedule")}
            className={[
              "flex-1 text-center rounded-pill py-2.5 text-sm font-semibold transition-colors",
              mode === "schedule" ? "bg-signal text-onsignal" : "text-mute",
            ].join(" ")}
          >
            Schedule
          </button>
          <button
            type="button"
            onClick={() => setMode("results")}
            className={[
              "flex-1 text-center rounded-pill py-2.5 text-sm font-semibold transition-colors",
              mode === "results" ? "bg-signal text-onsignal" : "text-mute",
            ].join(" ")}
          >
            Results{resultsCount > 0 ? ` ${resultsCount}` : ""}
          </button>
        </div>
      </div>

      <div className="pt-3">{mode === "schedule" ? schedule : results}</div>
    </div>
  );
}
