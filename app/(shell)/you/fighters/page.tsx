import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { BackButton } from "@/components/event/ContextBar";

export default async function FollowedFightersPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/you/fighters");

  const follows = await prisma.fighterFollow.findMany({
    where: { userId: actor.userId },
    include: { fighter: { include: { club: true } } },
    orderBy: { id: "desc" },
  });

  return (
    <div className="space-y-4 pt-2">
      <BackButton />
      <h1 className="text-2xl font-semibold">Followed fighters</h1>

      {follows.length === 0 ? (
        <div className="text-center py-10 space-y-1">
          <p className="text-sm font-medium">No followed fighters yet.</p>
          <p className="text-xs text-mute">Follow fighters to get updates about their fights.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {follows.map(({ fighter }) => (
            <Link
              key={fighter.id}
              href={`/fighters/${fighter.id}`}
              className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{fighter.displayName}</p>
                <p className="text-xs text-mute mt-0.5">{fighter.club?.name ?? "Independent"}</p>
              </div>
              <span className="text-mute">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
