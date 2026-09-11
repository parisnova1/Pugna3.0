export function formatEventDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

/** "Sep 20, 2026 · 7:00 PM" — falls back to just the date when there's no start time. */
export function formatEventDateTime(date: Date, startTime: Date | null): string {
  return startTime ? `${formatEventDate(date)} · ${formatTime(startTime)}` : formatEventDate(date);
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

/** "Sep 8–10, 2026" for a multi-day event, collapsing to a single date when
 * there's only one day — days are assumed consecutive, same assumption
 * `currentDayNumber` already makes. */
export function formatDateRange(date: Date, dayCount: number): string {
  if (dayCount <= 1) return formatEventDate(date);
  const end = new Date(date);
  end.setDate(end.getDate() + dayCount - 1);
  const sameMonth = date.getMonth() === end.getMonth() && date.getFullYear() === end.getFullYear();
  const startLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
  const endLabel = sameMonth
    ? new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(end)
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(end);
  return `${startLabel}–${endLabel}, ${end.getFullYear()}`;
}

/** "Today · 8 bouts" / "Tomorrow" / "Wednesday · 5 bouts" — the context line
 * under the Day selector's active segment. */
export function dayContextLabel(eventDate: Date, dayNumber: number, boutCount: number, now: Date = new Date()): string {
  const dayDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  dayDate.setDate(dayDate.getDate() + dayNumber - 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dayDate.getTime() - today.getTime()) / 86_400_000);

  const relative = diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : diffDays === -1 ? "Yesterday" : null;
  const label = relative ?? new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(dayDate);
  return boutCount > 0 ? `${label} · ${boutCount} bout${boutCount === 1 ? "" : "s"}` : label;
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
