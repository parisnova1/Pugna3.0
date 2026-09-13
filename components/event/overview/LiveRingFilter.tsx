"use client";

import { useState, type ReactNode } from "react";

/**
 * "All Rings / Ring 1 / Ring 2 / ..." filter over already-rendered
 * `RingSection` blocks — same "server renders every panel, client only
 * toggles visibility" pattern as `ScheduleResultsToggle`, so ring/projection
 * data never crosses the client boundary and switching rings never
 * re-fetches or flickers. Only meant to be rendered when there's more than
 * one ring; callers should skip it entirely for single-ring events.
 */
export function LiveRingFilter({ sections }: { sections: { id: string; label: string; node: ReactNode }[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className={[
            "shrink-0 rounded-pill px-4 py-2 text-sm font-medium border transition-colors",
            selected === null ? "bg-signal text-onsignal border-signal" : "border-white/15 text-mute",
          ].join(" ")}
        >
          All Rings
        </button>
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelected(s.id)}
            className={[
              "shrink-0 rounded-pill px-4 py-2 text-sm font-medium border transition-colors",
              selected === s.id ? "bg-signal text-onsignal border-signal" : "border-white/15 text-mute",
            ].join(" ")}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {sections.map((s) => (
          <div key={s.id} className={selected !== null && selected !== s.id ? "hidden" : undefined}>
            {s.node}
          </div>
        ))}
      </div>
    </div>
  );
}
