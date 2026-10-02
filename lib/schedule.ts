import { formatEventDateTime } from "@/lib/format";

/** True when a bout's start time genuinely moved (including being set or cleared). */
export function scheduleChanged(previous: Date | null, next: Date | null): boolean {
  return (previous?.getTime() ?? null) !== (next?.getTime() ?? null);
}

/** Bouts that have already run (or been called off) can't be rescheduled in a way anyone needs to hear about. */
const SETTLED_BOUT_STATUSES = ["FINAL", "SCRATCHED", "NO_SHOW"];

export function isReschedulable(boutStatus: string): boolean {
  return !SETTLED_BOUT_STATUSES.includes(boutStatus);
}

/**
 * Notification copy for a changed start time. Fighters hear it as "your
 * bout"; people who saved the bout hear who is fighting.
 */
export function rescheduleMessage(input: {
  audience: "fighter" | "watcher";
  eventName: string;
  when: Date | null;
  matchup?: string;
}): string {
  const subject = input.audience === "fighter" ? "Your bout" : (input.matchup ?? "A saved bout");
  if (!input.when) {
    return `${subject} at ${input.eventName} no longer has a set time -- the organizer will confirm a new one.`;
  }
  return `${subject} at ${input.eventName} has been rescheduled to ${formatEventDateTime(input.when, input.when)}.`;
}
