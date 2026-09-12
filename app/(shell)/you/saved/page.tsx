import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";
import { BackButton } from "@/components/event/ContextBar";
import { Badge } from "@/components/ui/Badge";

export default async function SavedFightsPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/you/saved");

  const savedBouts = await prisma.savedBout.findMany({
    where: { userId: actor.userId },
    include: { bout: { include: { fighterA: true, fighterB: true, event: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Live fights first, then soonest-scheduled — matches the brief's "🔴 LIVE" mock.
  const sorted = [...savedBouts].sort((a, b) => {
    const aLive = a.bout.status === "IN_PROGRESS";
    const bLive = b.bout.status === "IN_PROGRESS";
    if (aLive !== bLive) return aLive ? -1 : 1;
    return a.bout.event.date.getTime() - b.bout.event.date.getTime();
  });

  return (
    <div className="space-y-4 pt-2">
      <BackButton />
      <h1 className="text-2xl font-semibold">Saved fights</h1>

      {sorted.length === 0 ? (
        <p className="text-mute text-sm py-10 text-center">No saved fights yet.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map(({ bout }) => {
            if (!bout.event.slug) return null;
            const isLive = bout.status === "IN_PROGRESS";
            return (
              <Link
                key={bout.id}
                href={`/e/${bout.event.slug}/bout/${bout.id}`}
                className={[
                  "block rounded-card border px-4 py-3",
                  isLive ? "border-live/40 bg-live/5" : "border-white/10 bg-panel",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  {isLive ? (
                    <Badge live tone="live">
                      Live
                    </Badge>
                  ) : (
                    <span className="text-xs text-mute">{formatEventDate(bout.event.date)}</span>
                  )}
                </div>
                <p className="text-sm font-medium mt-1">
                  {bout.fighterA?.displayName ?? "TBD"} <span className="text-mute font-normal">vs</span>{" "}
                  {bout.fighterB?.displayName ?? "TBD"}
                </p>
                <p className="text-xs text-mute mt-0.5">{bout.event.name}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
