import type { BoutStatus, EventStatus } from "@prisma/client";

export type ProjectableBout = { id: string; number: number; status: BoutStatus };

/**
 * NOW / NEXT projection — blueprint §6. Server-only. Both the public Event
 * Card and the Live Console must call this same function; clients never
 * invent NOW/NEXT themselves.
 *
 * Rules:
 * - Ignore DRAFT bouts on public surfaces.
 * - NOW = the IN_PROGRESS bout if any; else the first non-terminal scheduled bout.
 * - DELAYED can be NOW. Public label is "DELAYED +N", not LIVE, unless IN_PROGRESS.
 * - NEXT = the following non-terminal bout.
 * - SCRATCHED, NO_SHOW, FINAL are never NOW or NEXT.
 * - INTERMISSION: hide the NOW pulse; show an estimate; reject START (409).
 * - PUBLISHED with no start yet: show UP NEXT + countdown, no LIVE pulse.
 * - FINISHED/ARCHIVED: now/next are null.
 */

const TERMINAL: BoutStatus[] = ["FINAL", "SCRATCHED", "NO_SHOW"];
const SCHEDULABLE: BoutStatus[] = ["TBD", "CONFIRMED", "READY", "DELAYED", "IN_PROGRESS"];

export type Projection<T extends ProjectableBout = ProjectableBout> = {
  now: T | null;
  next: T | null;
  nowLabel: "LIVE" | "DELAYED" | "UP_NEXT" | "INTERMISSION" | null;
};

export function computeProjection<T extends ProjectableBout>(eventStatus: EventStatus, bouts: T[]): Projection<T> {
  if (eventStatus === "FINISHED" || eventStatus === "ARCHIVED" || eventStatus === "CANCELLED") {
    return { now: null, next: null, nowLabel: null };
  }

  const ordered = [...bouts]
    .filter((b) => b.status !== "DRAFT")
    .sort((a, b) => a.number - b.number);

  const inProgress = ordered.find((b) => b.status === "IN_PROGRESS");

  if (eventStatus === "INTERMISSION") {
    const next = ordered.find((b) => SCHEDULABLE.includes(b.status) && !TERMINAL.includes(b.status));
    return { now: null, next: next ?? null, nowLabel: "INTERMISSION" };
  }

  if (inProgress) {
    const next = ordered.find((b) => b.number > inProgress.number && !TERMINAL.includes(b.status) && SCHEDULABLE.includes(b.status));
    return { now: inProgress, next: next ?? null, nowLabel: "LIVE" };
  }

  const nowCandidate = ordered.find((b) => !TERMINAL.includes(b.status) && SCHEDULABLE.includes(b.status));

  if (!nowCandidate) {
    return { now: null, next: null, nowLabel: null };
  }

  const next = ordered.find((b) => b.number > nowCandidate.number && !TERMINAL.includes(b.status) && SCHEDULABLE.includes(b.status));

  // No bout is IN_PROGRESS here (that's the branch above), so the label is
  // never "LIVE" — a scheduled-but-unstarted bout must never show the LIVE
  // pulse, whether the event hasn't started yet or is between bouts.
  const label = nowCandidate.status === "DELAYED" ? "DELAYED" : "UP_NEXT";

  return { now: nowCandidate, next: next ?? null, nowLabel: label };
}

/** Rejects START while the event is in INTERMISSION (blueprint §6). Throws a modeled 409. */
export class ProjectionConflictError extends Error {
  status = 409 as const;
}

export function assertStartAllowed(eventStatus: EventStatus): void {
  if (eventStatus === "INTERMISSION") {
    throw new ProjectionConflictError("Cannot start a bout during intermission.");
  }
}
