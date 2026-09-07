import type { EventStatus } from "@prisma/client";

/**
 * Event: DRAFT → READY → PUBLISHED → LIVE ⇄ INTERMISSION → FINISHED → ARCHIVED
 * Exits: CANCELLED from draft or after publish (blueprint §5).
 */
const TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ["READY", "CANCELLED"],
  READY: ["PUBLISHED", "DRAFT", "CANCELLED"],
  PUBLISHED: ["LIVE", "CANCELLED"],
  LIVE: ["INTERMISSION", "FINISHED", "CANCELLED"],
  INTERMISSION: ["LIVE", "FINISHED", "CANCELLED"],
  FINISHED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: [],
};

export class IllegalTransitionError extends Error {
  status = 409 as const;
  constructor(from: string, to: string, entity: string) {
    super(`Illegal ${entity} transition: ${from} -> ${to}`);
  }
}

export function canTransitionEvent(from: EventStatus, to: EventStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionEvent(from: EventStatus, to: EventStatus): EventStatus {
  if (!canTransitionEvent(from, to)) {
    throw new IllegalTransitionError(from, to, "event");
  }
  return to;
}
