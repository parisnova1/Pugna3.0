"use client";

import { useEffect, useState } from "react";

/**
 * Ticking mm:ss countdown to an absolute timestamp. Computed client-side
 * from `phaseEndsAt` every second — correct across reloads and poll
 * latency since it never trusts a "seconds remaining" snapshot, only the
 * stored end time.
 */
export function RoundTimer({ phaseEndsAt }: { phaseEndsAt: string | Date }) {
  const targetMs = new Date(phaseEndsAt).getTime();
  const [remainingMs, setRemainingMs] = useState(() => targetMs - Date.now());

  useEffect(() => {
    const tick = () => setRemainingMs(targetMs - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;

  return (
    <span className="tabular">
      {mm}:{String(ss).padStart(2, "0")}
    </span>
  );
}
