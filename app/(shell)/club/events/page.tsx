import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { nominateFighter } from "@/lib/actions/request";
import { ActionForm } from "@/components/host/ActionForm";
import { SeeAllLink } from "@/components/event/SeeAllLink";
import { formatEventDate } from "@/lib/format";
import type { Requirement } from "@/lib/actions/request";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

export default async function ClubEventsPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club/events");
  const clubId = actor.adminClubIds[0];
  if (!clubId) redirect("/club");

  const [hosting, requests, roster] = await Promise.all([
    prisma.event.findMany({ where: { organizingClubId: clubId }, orderBy: { date: "desc" }, take: 10 }),
    prisma.eventRequest.findMany({
      where: { clubId, status: { in: ["PENDING", "PARTIAL"] } },
      include: { event: true },
    }),
    prisma.fighterProfile.findMany({ where: { clubId } }),
  ]);

  return (
    <div className="space-y-8 pt-2">
      <h1 className="text-2xl font-semibold">Club events</h1>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Hosting</h2>
          <SeeAllLink href="/host" label="Host event" />
        </div>
        {hosting.length === 0 ? (
          <p className="text-sm text-mute">Not hosting anything.</p>
        ) : (
          hosting.map((e) => (
            <Link key={e.id} href={e.slug ? `/e/${e.slug}` : `/host/events/${e.id}`} className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3">
              <p className="text-sm font-medium">{e.name}</p>
              <p className="text-xs text-mute">{formatEventDate(e.date)}</p>
            </Link>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-mute">No requests.</p>
        ) : (
          requests.map((req) => {
            const reqs = (req.requirements as Requirement[]) ?? [];
            return (
              <div key={req.id} className="rounded-card bg-panel border border-white/10 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">{req.event.name}</p>
                  <p className="text-xs text-mute">{formatEventDate(req.event.date)}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {reqs.map((r, i) => (
                    <span key={i} className="text-[11px] rounded-pill border border-white/10 px-2 py-0.5 text-mute">
                      {r.weightClass} × {r.need}
                    </span>
                  ))}
                </div>
                {roster.length > 0 ? (
                  <ActionForm action={nominateFighter} submitLabel="Nominate" className="space-y-2">
                    <input type="hidden" name="eventId" value={req.eventId} />
                    <input type="hidden" name="clubId" value={clubId} />
                    <select name="fighterId" required className={inputClass}>
                      <option value="">Select fighter</option>
                      {roster.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.displayName}
                        </option>
                      ))}
                    </select>
                    <input name="weightClass" placeholder="Weight class" required className={inputClass} />
                  </ActionForm>
                ) : (
                  <p className="text-xs text-mute">Add fighters to your roster first.</p>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
