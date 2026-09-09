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
  nowLabel: "LIVE" | "DELAYED" | "UP_NEXT" | "INTERMISSION" | "BREAK" | null;
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

export type ProjectableRing = { id: string };

/**
 * Per-ring projections (Phase 2 — Day/Ring hierarchy). Groups bouts by
 * `ringId` and computes an independent NOW/NEXT per ring, so one ring's
 * live state never bleeds into another's. A ring `onBreak` short-circuits
 * that ring's projection the same way event-wide INTERMISSION does, but
 * scoped to just that ring.
 */
export function computeRingProjections<T extends ProjectableBout & { ringId: string }>(
  eventStatus: EventStatus,
  rings: (ProjectableRing & { onBreak: boolean })[],
  bouts: T[],
): Map<string, Projection<T>> {
  const result = new Map<string, Projection<T>>();

  for (const ring of rings) {
    const ringBouts = bouts.filter((b) => b.ringId === ring.id);

    if (ring.onBreak && eventStatus !== "FINISHED" && eventStatus !== "ARCHIVED" && eventStatus !== "CANCELLED") {
      const next = ringBouts
        .filter((b) => b.status !== "DRAFT")
        .sort((a, b) => a.number - b.number)
        .find((b) => SCHEDULABLE.includes(b.status) && !TERMINAL.includes(b.status));
      result.set(ring.id, { now: null, next: next ?? null, nowLabel: "BREAK" });
      continue;
    }

    result.set(ring.id, computeProjection(eventStatus, ringBouts));
  }

  return result;
}

/** True if any ring is currently showing a LIVE bout. */
export function isEventLive(ringProjections: Map<string, Projection>): boolean {
  return Array.from(ringProjections.values()).some((p) => p.nowLabel === "LIVE");
}

/** Rejects START while the event is in INTERMISSION or the ring is on break (blueprint §6 + Phase 2). Throws a modeled 409. */
export class ProjectionConflictError extends Error {
  status = 409 as const;
}

export function assertStartAllowed(eventStatus: EventStatus, ringOnBreak = false): void {
  if (eventStatus === "INTERMISSION") {
    throw new ProjectionConflictError("Cannot start a bout during intermission.");
  }
  if (ringOnBreak) {
    throw new ProjectionConflictError("Cannot start a bout while this ring is on break.");
  }
}
