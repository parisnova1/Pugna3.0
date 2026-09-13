import { TabBar } from "@/components/nav/TabBar";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();

  // Only organizers pay for this query, and it's a single indexed lookup
  // against the event ids already resolved onto the session — cheap enough
  // to run on every (shell) page load.
  const liveEvent =
    actor?.isOrganizer && actor.hostEventIds.length > 0
      ? await prisma.event.findFirst({
          where: { id: { in: actor.hostEventIds }, status: { in: ["LIVE", "INTERMISSION"] } },
          select: { id: true },
        })
      : null;

  return (
    <div className="min-h-screen pb-24">
      <main className="mx-auto w-full max-w-md px-4 pt-6">{children}</main>
      <TabBar isOrganizer={actor?.isOrganizer ?? false} liveEventId={liveEvent?.id ?? null} />
    </div>
  );
}
