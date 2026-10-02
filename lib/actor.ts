import { auth } from "@/lib/auth";
import type { Actor } from "@/lib/rbac";
import { isEmailConfigured } from "@/lib/security/email";

/** Resolves the current session into the RBAC Actor shape (null = guest). */
export async function getActor(): Promise<Actor> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    userId: session.user.id,
    isBoxer: session.user.isBoxer,
    clubIds: session.user.clubIds,
    isOrganizer: session.user.isOrganizer,
    // Without a mail provider nobody *can* verify, so don't lock people out.
    emailVerified: session.user.emailConfirmed || !isEmailConfigured(),
    hostEventIds: session.user.hostEventIds,
    hostRoles: session.user.hostRoles ?? {},
    clubRoles: session.user.clubRoles ?? {},
  };
}
