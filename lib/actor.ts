import { auth } from "@/lib/auth";
import type { Actor } from "@/lib/rbac";

/** Resolves the current session into the RBAC Actor shape (null = guest). */
export async function getActor(): Promise<Actor> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    userId: session.user.id,
    isBoxer: session.user.isBoxer,
    clubIds: session.user.clubIds,
    isOrganizer: session.user.isOrganizer,
    hostEventIds: session.user.hostEventIds,
  };
}
