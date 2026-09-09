/**
 * Pure RBAC module. Every server action / route handler must call `can()`
 * before mutating or returning gated data. Never rely on the UI hiding a
 * button as the only enforcement.
 *
 * Capabilities are existence-based, never "active": a user can simultaneously
 * be a Boxer, admin several Clubs, and hold an Organizer profile. There is no
 * concept of a switched/active role anywhere in this module — see
 * components/nav/TabBar.tsx, which decides *navigation* purely from the
 * current route, never from these capabilities.
 */

export type DenyCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNPUBLISHED"
  | "CONFLICT"
  | "VALIDATION_BLOCKED"
  | "CLUB_CLAIMED"
  | "HOST_MEMBERSHIP_MISSING"
  | "CONTEXT_REQUIRED";

export type CanResult =
  | { allowed: true }
  | { allowed: false; code: DenyCode; reason: string };

export type Actor = {
  userId: string;
  isBoxer: boolean;
  clubIds: string[];
  isOrganizer: boolean;
  hostEventIds: string[];
} | null; // null = guest

const allow = (): CanResult => ({ allowed: true });
const deny = (code: DenyCode, reason: string): CanResult => ({ allowed: false, code, reason });

export type Action =
  | "event.view"
  | "event.follow"
  | "event.create"
  | "event.edit"
  | "event.publish"
  | "event.cancel"
  | "live.access"
  | "live.act"
  | "club.claim"
  | "club.admin"
  | "club.nominate"
  | "nomination.respond";

export type Resource = {
  eventId?: string;
  eventPublished?: boolean;
  clubId?: string;
  clubClaimed?: boolean;
};

export function can(actor: Actor, action: Action, resource: Resource = {}): CanResult {
  switch (action) {
    case "event.view": {
      // Guests may view published+ events. Unpublished (DRAFT/READY) is host-only.
      if (resource.eventPublished === false) {
        if (!actor) return deny("UNPUBLISHED", "Event is not published yet.");
        if (!resource.eventId || !actor.hostEventIds.includes(resource.eventId)) {
          return deny("UNPUBLISHED", "Event is not published yet.");
        }
      }
      return allow();
    }

    case "event.follow": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in to follow this event.");
      return allow();
    }

    case "event.create": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in to create an event.");
      if (!actor.isOrganizer && actor.clubIds.length === 0) {
        return deny("CONTEXT_REQUIRED", "Become an organizer, or host through a club.");
      }
      return allow();
    }

    case "event.edit":
    case "event.publish":
    case "event.cancel":
    case "live.access":
    case "live.act": {
      // Host membership is the entire authority here — it already covers both
      // an independent organizer and a club admin whose club is hosting.
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      if (!resource.eventId || !actor.hostEventIds.includes(resource.eventId)) {
        return deny("HOST_MEMBERSHIP_MISSING", "You are not a host member of this event.");
      }
      return allow();
    }

    case "club.claim": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      if (resource.clubClaimed) return deny("CLUB_CLAIMED", "This club is already claimed.");
      return allow();
    }

    case "club.admin":
    case "club.nominate": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      if (!resource.clubId || !actor.clubIds.includes(resource.clubId)) {
        return deny("FORBIDDEN", "You do not administer this club.");
      }
      return allow();
    }

    case "nomination.respond": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      return allow();
    }

    default:
      return deny("FORBIDDEN", "Unknown action.");
  }
}

/** Reject `//` and absolute URLs — returnTo must stay an internal path. */
export function sanitizeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) return "/";
  if (!returnTo.startsWith("/")) return "/";
  if (returnTo.startsWith("//")) return "/";
  if (/^\/\/|^\/\\|^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(returnTo)) return "/";
  return returnTo;
}
