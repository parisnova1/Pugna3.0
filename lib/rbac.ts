import type { EventRole, ClubRole } from "@prisma/client";

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
 *
 * Permissions are ROLE + SCOPE, never a single global role: a user's power
 * over a given event or club comes from that specific EventHostMember/
 * ClubAdmin row's `role`, held in `hostRoles`/`clubRoles` below, keyed by
 * eventId/clubId — the same user can be EVENT_OWNER of one event and
 * RING_OFFICIAL (scoped to a subset of `ringIds`) of another. `hostEventIds`/
 * `clubIds` stay as plain derived arrays (membership only, any role) so
 * every existing `.includes()` call site keeps working unchanged.
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
  hostRoles: Record<string, { role: EventRole; ringIds: string[] }>;
  clubRoles: Record<string, ClubRole>;
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
  | "event.manageClubs"
  | "live.access"
  | "live.act"
  | "club.claim"
  | "club.admin"
  | "club.nominate"
  | "club.follow"
  | "club.join"
  | "fighter.follow"
  | "fighter.notifyNextBout"
  | "bout.save"
  | "nomination.respond"
  | "sparring.view"
  | "crowd.write";

export type Resource = {
  eventId?: string;
  eventPublished?: boolean;
  ringId?: string;
  ringIds?: string[];
  clubId?: string;
  clubClaimed?: boolean;
  sparringAccessMode?: "INVITE" | "OPEN_TO_CLUBS" | "OPEN";
  sparringPrivileged?: boolean;
  checkedIn?: boolean;
  boutInProgress?: boolean;
  muted?: boolean;
  hasFighterProfile?: boolean;
  alreadyInAClub?: boolean;
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
    case "event.manageClubs": {
      // Full event control — Owner and Admin only. Ring Officials and Staff
      // never reach these (pairing, publishing, cancelling, club invites).
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      const membership = resource.eventId ? actor.hostRoles[resource.eventId] : undefined;
      if (!membership) return deny("HOST_MEMBERSHIP_MISSING", "You are not a host member of this event.");
      if (membership.role === "EVENT_OWNER" || membership.role === "EVENT_ADMIN") return allow();
      return deny("FORBIDDEN", "Only an event owner or admin can do this.");
    }

    case "live.access": {
      // Viewing the console — any host membership role, including Ring
      // Official and Staff (Staff is read-only; enforced by live.act below).
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      if (!resource.eventId || !actor.hostRoles[resource.eventId]) {
        return deny("HOST_MEMBERSHIP_MISSING", "You are not a host member of this event.");
      }
      return allow();
    }

    case "live.act": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      const membership = resource.eventId ? actor.hostRoles[resource.eventId] : undefined;
      if (!membership) return deny("HOST_MEMBERSHIP_MISSING", "You are not a host member of this event.");
      if (membership.role === "EVENT_OWNER" || membership.role === "EVENT_ADMIN") return allow();
      if (membership.role === "RING_OFFICIAL") {
        const targetRingIds = resource.ringIds ?? (resource.ringId ? [resource.ringId] : []);
        if (targetRingIds.length === 0) {
          return deny("FORBIDDEN", "This action isn't scoped to a ring you're assigned to.");
        }
        const cleared = targetRingIds.every((id) => membership.ringIds.includes(id));
        return cleared ? allow() : deny("FORBIDDEN", "You can only act on your assigned ring.");
      }
      return deny("FORBIDDEN", "Event staff cannot perform live actions.");
    }

    case "club.claim": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      if (resource.clubClaimed) return deny("CLUB_CLAIMED", "This club is already claimed.");
      return allow();
    }

    case "club.admin": {
      // Settings, membership, coaches, transfer — Owner and Admin only.
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      const role = resource.clubId ? actor.clubRoles[resource.clubId] : undefined;
      if (role === "CLUB_OWNER" || role === "CLUB_ADMIN") return allow();
      return deny("FORBIDDEN", "You do not administer this club.");
    }

    case "club.nominate": {
      // Submitting/nominating athletes onto an event or session — Coaches too.
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      const role = resource.clubId ? actor.clubRoles[resource.clubId] : undefined;
      if (role === "CLUB_OWNER" || role === "CLUB_ADMIN" || role === "COACH") return allow();
      return deny("FORBIDDEN", "You do not administer this club.");
    }

    case "nomination.respond": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in required.");
      return allow();
    }

    case "sparring.view": {
      // Open / Open-to-clubs sessions are publicly visible. Invite sessions
      // are only visible to the host club, an invited club, or a fighter who
      // is nominated/confirmed on it — resource.sparringPrivileged is
      // precomputed by the caller from those DB rows.
      if (resource.sparringAccessMode !== "INVITE") return allow();
      if (!actor) return deny("FORBIDDEN", "This session is invite-only.");
      if (resource.sparringPrivileged) return allow();
      return deny("FORBIDDEN", "This session is invite-only.");
    }

    case "club.follow": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in to follow this club.");
      return allow();
    }

    case "fighter.follow": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in to follow this fighter.");
      return allow();
    }

    case "fighter.notifyNextBout": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in to get notified.");
      return allow();
    }

    case "bout.save": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in to save this fight.");
      return allow();
    }

    case "club.join": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in to join this club.");
      if (!resource.hasFighterProfile) return deny("CONTEXT_REQUIRED", "Register as a boxer to join a club.");
      if (resource.alreadyInAClub) return deny("CONFLICT", "You're already with a club.");
      return allow();
    }

    case "crowd.write": {
      if (!actor) return deny("AUTH_REQUIRED", "Sign in to join the crowd.");
      if (!resource.checkedIn) return deny("CONTEXT_REQUIRED", "Check in at the event to join the crowd.");
      if (!resource.boutInProgress) return deny("FORBIDDEN", "This fight isn't live.");
      if (resource.muted) return deny("FORBIDDEN", "You've been muted for this event.");
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
