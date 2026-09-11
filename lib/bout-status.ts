import type { BoutStatus, EventStatus } from "@prisma/client";
import type { Projection } from "@/lib/projection";

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

/** Top-level event status pill (LIVE NOW / UPCOMING / COMPLETED / CANCELLED
 * family) — a plain server-safe function so both the event page (a Server
 * Component) and LiveEventCard (a Client Component) can compute the exact
 * same pill from the same inputs without either importing the other's
 * client/server boundary. */
export function eventStatusPillFor(
  status: EventStatus,
  nowLabel: Projection["nowLabel"],
): { text: string; live: boolean } | null {
  if (status === "CANCELLED") return { text: "Cancelled", live: false };
  if (status === "FINISHED" || status === "ARCHIVED") return { text: "Completed", live: false };
  if (nowLabel === "LIVE") return { text: "Live now", live: true };
  if (nowLabel === "INTERMISSION") return { text: "Intermission", live: false };
  if (nowLabel === "BREAK") return { text: "On break", live: false };
  if (status === "PUBLISHED") return { text: "Upcoming", live: false };
  if (status === "LIVE") return { text: "In progress", live: false };
  return null;
}
