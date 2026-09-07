import type { Hat } from "@prisma/client";

/**
 * Pure RBAC module — blueprint §7. Every server action / route handler must
 * call `can()` before mutating or returning gated data. Never rely on the UI
 * hiding a button as the only enforcement.
 */

export type DenyCode =
  | "AUTH_REQUIRED"
  | "HAT_NOT_GRANTED"
  | "HAT_SWITCH_REQUIRED"
  | "INVALID_HAT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNPUBLISHED"
  | "CONFLICT"
  | "VALIDATION_BLOCKED"
  | "CLUB_CLAIMED"
  | "HOST_MEMBERSHIP_MISSING";

export type CanResult =
  | { allowed: true }
  | { allowed: false; code: DenyCode; reason: string };

export type Actor = {
  userId: string;
  hats: Hat[];
  activeHat: Hat | null;
  adminClubIds: string[];
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
  | "nomination.respond"
  | "hat.switch";

export type Resource = {
  eventId?: string;
  eventPublished?: boolean;
  clubId?: string;
  clubClaimed?: boolean;
  targetHat?: Hat;
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
      if (!actor.hats.includes("ORGANIZER")) return deny("HAT_NOT_GRANTED", "Organizer hat required.");
      return allow();
    }

    case "event.edit":
    case "event.publish":
    case "event.cancel": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      if (actor.activeHat !== "ORGANIZER") return deny("HAT_SWITCH_REQUIRED", "Switch to Organizer hat.");
      if (!resource.eventId || !actor.hostEventIds.includes(resource.eventId)) {
        return deny("HOST_MEMBERSHIP_MISSING", "You are not a host member of this event.");
      }
      return allow();
    }

    case "live.access":
    case "live.act": {
      // Organizer hat AND hostEventIds contains event. Fighter hat is denied
      // even for a host member fighting on their own card (per spec).
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      if (actor.activeHat !== "ORGANIZER") return deny("HAT_SWITCH_REQUIRED", "Switch to Organizer hat to run the console.");
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
      if (actor.activeHat !== "CLUB") return deny("HAT_SWITCH_REQUIRED", "Switch to Club hat.");
      if (!resource.clubId || !actor.adminClubIds.includes(resource.clubId)) {
        return deny("FORBIDDEN", "You do not administer this club.");
      }
      return allow();
    }

    case "nomination.respond": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      if (actor.activeHat !== "FIGHTER") return deny("HAT_SWITCH_REQUIRED", "Switch to Fighter hat.");
      return allow();
    }

    case "hat.switch": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      if (!resource.targetHat) return deny("INVALID_HAT", "No hat specified.");
      if (!actor.hats.includes(resource.targetHat)) return deny("HAT_NOT_GRANTED", "Hat not granted to this account.");
      return allow();
    }

    default:
      return deny("FORBIDDEN", "Unknown action.");
  }
}

/** Reject `//` and absolute URLs — returnTo must stay an internal path (blueprint §7). */
export function sanitizeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) return "/";
  if (!returnTo.startsWith("/")) return "/";
  if (returnTo.startsWith("//")) return "/";
  if (/^\/\/|^\/\\|^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(returnTo)) return "/";
  return returnTo;
}
