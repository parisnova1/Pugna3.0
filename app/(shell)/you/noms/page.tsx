import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { respondToNomination } from "@/lib/actions/request";
import { formatEventDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function NominationsInboxPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/you/noms");

  const fighter = await prisma.fighterProfile.findUnique({ where: { userId: actor.userId } });
  if (!fighter) redirect("/you");

  const nominations = await prisma.nomination.findMany({
    where: { fighterId: fighter.id },
    include: { event: true, club: true },
    orderBy: { createdAt: "desc" },
  });

  const pending = nominations.filter((n) => n.status === "CREATED" || n.status === "PENDING");
  const other = nominations.filter((n) => n.status !== "CREATED" && n.status !== "PENDING");

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">Nominations</h1>

      {pending.length === 0 ? (
        <EmptyState>No nominations.</EmptyState>
      ) : (
        <div className="space-y-3">
          {pending.map((nom) => (
            <div key={nom.id} className="rounded-card bg-panel border border-white/10 p-4 space-y-2">
              <p className="font-medium text-sm">{nom.event.name}</p>
              <p className="text-xs text-mute">
                {nom.club.name} · {nom.weightClass} · {formatEventDate(nom.event.date)}
              </p>
              <div className="flex gap-2 pt-1">
                <form
                  action={async () => {
                    "use server";
                    await respondToNomination(nom.id, true);
                  }}
                  className="flex-1"
                >
                  <Button type="submit" size="xs" text="sm" fullWidth>
                    Accept
                  </Button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await respondToNomination(nom.id, false);
                  }}
                  className="flex-1"
                >
                  <Button type="submit" variant="outline" size="xs" text="sm" fullWidth>
                    Decline
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {other.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Past</p>
          {other.map((nom) => (
            <div key={nom.id} className="flex items-center justify-between rounded-card border border-white/10 px-4 py-3">
              <p className="text-sm">{nom.event.name}</p>
              <span className="text-xs text-mute">{nom.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
