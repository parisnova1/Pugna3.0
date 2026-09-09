export function formatEventDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatUpdatedAt(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

/**
 * Which day of a multi-day event "today" falls on, assuming each day runs on
 * consecutive calendar dates starting at `eventDate` (blueprint has no
 * separate per-day date yet — Bout.day is just an index). Clamped to
 * [1, dayCount] so a not-yet-started event defaults to Day 1 and a finished
 * one stays on its last day, rather than resetting to Day 1 forever.
 */
export function currentDayNumber(eventDate: Date, dayCount: number, now: Date = new Date()): number {
  const start = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - start.getTime()) / 86_400_000);
  return Math.min(Math.max(1, diffDays + 1), dayCount);
}

/** "2d 14h" style countdown to a start time. */
export function formatCountdown(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "Starting now";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
