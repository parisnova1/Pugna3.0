import type { EventStatus } from "@prisma/client";

export const DAY_MS = 86_400_000;

/**
 * An event counts as over this long after its last calendar day finishes. The
 * margin covers late-running shows and the gap between UTC and the venue's
 * local time, without leaving yesterday's event listed as "upcoming".
 */
const END_GRACE_MS = 12 * 3_600_000;

/** Events longer than this many days aren't expected; used only to bound database pre-filters. */
export const MAX_EVENT_DAYS = 31;
export const LOOKBACK_MS = MAX_EVENT_DAYS * DAY_MS;

type Timed = { date: Date; dayCount: number };

export const utcDayStart = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export function eventEndsAt(event: Timed): Date {
  return new Date(utcDayStart(event.date) + Math.max(1, event.dayCount) * DAY_MS + END_GRACE_MS);
}

export function hasEnded(event: Timed, now: Date = new Date()): boolean {
  return eventEndsAt(event).getTime() <= now.getTime();
}

/** True when the event has a day that falls on the day starting at `dayStartMs` (UTC). */
export function spansDay(event: Timed, dayStartMs: number): boolean {
  const first = utcDayStart(event.date);
  return first <= dayStartMs && dayStartMs < first + Math.max(1, event.dayCount) * DAY_MS;
}

export type DisplayStatus = EventStatus | "ENDED";

const ACTIVE: readonly EventStatus[] = ["PUBLISHED", "LIVE", "INTERMISSION"];

/**
 * The status the public should see. A host who never pressed "Finish" leaves an
 * event stuck on PUBLISHED/LIVE forever; once its dates are well past it is
 * shown as ENDED instead of "Upcoming" or "Live". Stored data is not changed.
 */
export function displayStatus(event: Timed & { status: EventStatus }, now: Date = new Date()): DisplayStatus {
  return ACTIVE.includes(event.status) && hasEnded(event, now) ? "ENDED" : event.status;
}

/** Swap a status pill for "Ended" when the event is stale; leave it alone otherwise. */
export function pillWithEnded<P extends { text: string; live: boolean } | null>(
  event: Timed & { status: EventStatus },
  pill: P,
  now: Date = new Date(),
): P | { text: string; live: boolean } {
  return displayStatus(event, now) === "ENDED" ? { text: "Ended", live: false } : pill;
}

/** Live-now events first, then by date: the order the Upcoming list should read in. */
export function liveFirst<E extends { status: EventStatus; date: Date }>(events: E[]): E[] {
  const rank = (e: E) => (e.status === "LIVE" || e.status === "INTERMISSION" ? 0 : 1);
  return [...events].sort((a, b) => rank(a) - rank(b) || a.date.getTime() - b.date.getTime());
}
