import type { BoutStatus } from "@prisma/client";

/**
 * Single source of truth for the schedule's status vocabulary — the four
 * major states (LIVE/NEXT/FINAL/SCHEDULED) plus the two real-but-minor ones
 * (Scratched/No-show), used identically by the ring NOW/NEXT block and the
 * grouped schedule list so the wording never drifts between the two.
 */
export function boutStatusLabel(status: BoutStatus, isNext: boolean, delayMinutes: number | null): string {
  if (status === "IN_PROGRESS") return "LIVE";
  if (status === "FINAL") return "FINAL";
  if (status === "SCRATCHED") return "Scratched";
  if (status === "NO_SHOW") return "No-show";
  if (isNext) return delayMinutes ? `NEXT · +${delayMinutes}m` : "NEXT";
  return "SCHEDULED";
}
