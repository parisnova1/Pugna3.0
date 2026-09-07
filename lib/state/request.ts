import type { RequestStatus } from "@prisma/client";
import { IllegalTransitionError } from "./event";

/** Request: PENDING → PARTIAL → COMPLETE. Exits DECLINED / EXPIRED. (blueprint §5) */
const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  PENDING: ["PARTIAL", "COMPLETE", "DECLINED", "EXPIRED"],
  PARTIAL: ["COMPLETE", "DECLINED", "EXPIRED"],
  COMPLETE: [],
  DECLINED: [],
  EXPIRED: [],
};

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionRequest(from: RequestStatus, to: RequestStatus): RequestStatus {
  if (!canTransitionRequest(from, to)) {
    throw new IllegalTransitionError(from, to, "request");
  }
  return to;
}
