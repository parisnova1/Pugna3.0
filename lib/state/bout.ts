import type { BoutStatus } from "@prisma/client";
import { IllegalTransitionError } from "./event";

/**
 * Bout: DRAFT → TBD → CONFIRMED → READY → IN_PROGRESS → FINAL
 * Exceptions (blueprint §5):
 *   CONFIRMED/READY/DELAYED/IN_PROGRESS -> SCRATCHED
 *   READY/DELAYED -> DELAYED
 *   READY/DELAYED -> NO_SHOW
 */
const TRANSITIONS: Record<BoutStatus, BoutStatus[]> = {
  DRAFT: ["TBD"],
  TBD: ["CONFIRMED", "SCRATCHED"],
  CONFIRMED: ["READY", "SCRATCHED"],
  READY: ["DELAYED", "IN_PROGRESS", "SCRATCHED", "NO_SHOW"],
  DELAYED: ["DELAYED", "IN_PROGRESS", "SCRATCHED", "NO_SHOW"],
  IN_PROGRESS: ["FINAL", "SCRATCHED"],
  FINAL: [],
  SCRATCHED: [],
  NO_SHOW: [],
};

export function canTransitionBout(from: BoutStatus, to: BoutStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionBout(from: BoutStatus, to: BoutStatus): BoutStatus {
  if (!canTransitionBout(from, to)) {
    throw new IllegalTransitionError(from, to, "bout");
  }
  return to;
}

/**
 * Legal bout console actions (blueprint §7 table). Each maps a UI action to
 * the statuses it's legal from and the status it produces.
 */
export type BoutAction = "START" | "FINISH" | "DELAY" | "SCRATCH" | "NO_SHOW" | "INTERMISSION_DELAY";

const LEGAL_FROM: Record<BoutAction, BoutStatus[]> = {
  START: ["READY", "DELAYED"],
  FINISH: ["IN_PROGRESS"],
  DELAY: ["READY", "DELAYED", "IN_PROGRESS"],
  SCRATCH: ["TBD", "CONFIRMED", "READY", "DELAYED", "IN_PROGRESS"],
  NO_SHOW: ["READY", "DELAYED"],
  INTERMISSION_DELAY: ["IN_PROGRESS"], // DELAY on IN_PROGRESS: estimate only, does not exit IN_PROGRESS
};

export function assertBoutAction(current: BoutStatus, action: BoutAction): void {
  if (!LEGAL_FROM[action].includes(current)) {
    throw new IllegalTransitionError(current, `${action} (rejected)`, "bout");
  }
}

/** Applies a console action and returns the resulting status. Pure — no I/O. */
export function applyBoutAction(current: BoutStatus, action: BoutAction): BoutStatus {
  assertBoutAction(current, action);
  switch (action) {
    case "START":
      return "IN_PROGRESS";
    case "FINISH":
      return "FINAL";
    case "DELAY":
      // DELAY on READY -> DELAYED. DELAY on IN_PROGRESS does not exit IN_PROGRESS (estimate only).
      return current === "IN_PROGRESS" ? "IN_PROGRESS" : "DELAYED";
    case "SCRATCH":
      return "SCRATCHED";
    case "NO_SHOW":
      return "NO_SHOW";
    case "INTERMISSION_DELAY":
      return "IN_PROGRESS";
  }
}
