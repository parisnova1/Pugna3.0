import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { BackButton } from "@/components/event/ContextBar";

export default async function FollowedClubsPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/you/clubs");

  const follows = await prisma.clubFollow.findMany({
    where: { userId: actor.userId },
    include: { club: true },
    orderBy: { id: "desc" },
  });

  return (
    <div className="space-y-4 pt-2">
      <BackButton />
      <h1 className="text-2xl font-semibold">Followed clubs</h1>

      {follows.length === 0 ? (
        <div className="text-center py-10 space-y-1">
          <p className="text-sm font-medium">No followed clubs yet.</p>
          <p className="text-xs text-mute">Join or follow a club to see it here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {follows.map(({ club }) => (
            <Link
              key={club.id}
              href={`/clubs/${club.id}`}
              className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{club.name}</p>
                <p className="text-xs text-mute mt-0.5">{club.city ?? club.sport}</p>
              </div>
              <span className="text-mute">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
