import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { formatCountdown } from "@/lib/format";
import { BellLink } from "@/components/nav/BellLink";
import { becomeBoxer } from "@/lib/actions/profile";

export default async function YouHomePage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/you");

  const unreadCount = await prisma.notification.count({ where: { userId: actor.userId, read: false } });

  const fighter = await prisma.fighterProfile.findUnique({ where: { userId: actor.userId } });
  if (!fighter) {
    return (
      <div className="pt-10 text-center space-y-3">
        <div className="flex justify-end">
          <BellLink unreadCount={unreadCount} />
        </div>
        <p className="text-mute text-sm">No boxer profile yet.</p>
        <form
          action={async () => {
            "use server";
            await becomeBoxer();
          }}
        >
          <button type="submit" className="inline-block rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm">
            Register as boxer
          </button>
        </form>
      </div>
    );
  }

  const nextBout = await prisma.bout.findFirst({
    where: {
      OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }],
      status: { in: ["CONFIRMED", "READY", "DELAYED", "IN_PROGRESS"] },
    },
    include: { event: true, fighterA: true, fighterB: true },
    orderBy: { scheduledTime: "asc" },
  });

  const pendingNoms = await prisma.nomination.count({
    where: { fighterId: fighter.id, status: { in: ["CREATED", "PENDING"] } },
  });

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{fighter.displayName}</h1>
        <BellLink unreadCount={unreadCount} />
      </div>

      <div className="rounded-card bg-panel border border-white/10 p-5">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Next bout</p>
        {nextBout ? (
          <>
            <p className="font-medium">
              {nextBout.event.name} · {nextBout.weightClass}
            </p>
            <p className="text-sm text-mute mt-1">
              vs {nextBout.fighterAId === fighter.id ? nextBout.fighterB?.displayName ?? "TBA" : nextBout.fighterA?.displayName ?? "TBA"}
            </p>
            <p className="text-sm text-signal mt-2">
              {nextBout.status === "IN_PROGRESS"
                ? "Live"
                : nextBout.event.startTime
                  ? formatCountdown(nextBout.event.startTime)
                  : "Scheduled"}
            </p>
            {nextBout.event.slug && (
              <Link href={`/e/${nextBout.event.slug}`} className="inline-block mt-3 text-sm text-ink underline">
                Go to card
              </Link>
            )}
          </>
        ) : (
          <p className="text-sm text-mute">No upcoming fights.</p>
        )}
      </div>

      {pendingNoms > 0 && (
        <Link href="/you/noms" className="block rounded-card border border-signal/30 bg-signal/5 p-4">
          <p className="text-sm font-medium">{pendingNoms} pending nomination{pendingNoms > 1 ? "s" : ""}</p>
          <p className="text-xs text-mute mt-1">Review and respond</p>
        </Link>
      )}
    </div>
  );
}
