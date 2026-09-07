import type { NominationStatus } from "@prisma/client";
import { IllegalTransitionError } from "./event";

/**
 * Nomination: CREATED → PENDING → ACCEPTED → CONFIRMED.
 * Exits: DECLINED -> club replacement; WITHDRAWN. (blueprint §5)
 * Fighter-facing label progression (NOMINATED..LIVE..FINAL) is a view-model
 * derived from this + the bout status, not a separate stored state.
 */
const TRANSITIONS: Record<NominationStatus, NominationStatus[]> = {
  CREATED: ["PENDING", "WITHDRAWN"],
  PENDING: ["ACCEPTED", "DECLINED", "WITHDRAWN"],
  ACCEPTED: ["CONFIRMED", "WITHDRAWN"],
  CONFIRMED: ["WITHDRAWN"],
  DECLINED: ["REPLACEMENT"],
  WITHDRAWN: [],
  REPLACEMENT: [],
};

export function canTransitionNomination(from: NominationStatus, to: NominationStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionNomination(from: NominationStatus, to: NominationStatus): NominationStatus {
  if (!canTransitionNomination(from, to)) {
    throw new IllegalTransitionError(from, to, "nomination");
  }
  return to;
}
