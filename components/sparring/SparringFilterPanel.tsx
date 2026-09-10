"use client";

import { useState } from "react";
import { FilterIcon, ChevronDownIcon } from "@/components/nav/icons";

/** Collapses the sport/area/sex/experience/radius filter fields behind a
 * single "Filter" button — the form itself is unchanged (still a plain GET
 * submit to /sparring, still server-rendered), this just toggles whether
 * it's visible. Starts open when a filter is already active so the viewer
 * sees what's applied without an extra tap. */
export function SparringFilterPanel({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-pill border border-white/15 text-ink text-sm font-medium px-4 py-2"
      >
        <FilterIcon className="w-4 h-4 shrink-0" />
        Filter
        {activeCount > 0 && (
          <span className="rounded-full bg-signal text-onsignal text-[11px] font-semibold w-5 h-5 flex items-center justify-center">
            {activeCount}
          </span>
        )}
        <ChevronDownIcon className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && children}
    </div>
  );
}
