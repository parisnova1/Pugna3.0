/**
 * The one definition of "published". DRAFT and READY events are still being
 * built and are visible only to their hosts; everything from PUBLISHED onward
 * (including FINISHED/CANCELLED/ARCHIVED, which guests can still read) is
 * public. This feeds RBAC's `event.view`, the sitemap and link metadata, so it
 * must not be re-derived inline anywhere.
 */
export const UNPUBLISHED_EVENT_STATUSES = ["DRAFT", "READY"] as const;

export function isPublishedEventStatus(status: string): boolean {
  return !(UNPUBLISHED_EVENT_STATUSES as readonly string[]).includes(status);
}

/** Events that can still take club entries and nominations (not yet running, not over). */
export const ENTRY_OPEN_EVENT_STATUSES = ["DRAFT", "READY", "PUBLISHED"] as const;

export function isEntryOpen(status: string): boolean {
  return (ENTRY_OPEN_EVENT_STATUSES as readonly string[]).includes(status);
}

/** Statuses during which the schedule can still change in a way worth telling people about. */
export const ACTIVE_EVENT_STATUSES = ["PUBLISHED", "LIVE", "INTERMISSION"] as const;

export function isActiveEventStatus(status: string): boolean {
  return (ACTIVE_EVENT_STATUSES as readonly string[]).includes(status);
}
