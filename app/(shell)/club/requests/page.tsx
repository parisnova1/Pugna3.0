import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { nominateFighter } from "@/lib/actions/request";
import { ActionForm } from "@/components/host/ActionForm";
import { formatEventDate } from "@/lib/format";
import type { Requirement } from "@/lib/actions/request";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

export default async function ClubRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club/requests");

  const { club: requestedClubId } = await searchParams;
  const clubId = requestedClubId && actor.clubIds.includes(requestedClubId) ? requestedClubId : actor.clubIds[0];
  if (!clubId) redirect("/club");

  const [requests, roster] = await Promise.all([
    prisma.eventRequest.findMany({
      where: { clubId, status: { in: ["PENDING", "PARTIAL"] } },
      include: { event: true },
    }),
    prisma.fighterProfile.findMany({ where: { clubId } }),
  ]);

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">Requests</h1>

      {requests.length === 0 ? (
        <p className="text-sm text-mute">No requests.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
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
                      <option value="">Select boxer</option>
                      {roster.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.displayName}
                        </option>
                      ))}
                    </select>
                    <input name="weightClass" placeholder="Weight class" required className={inputClass} />
                  </ActionForm>
                ) : (
                  <p className="text-xs text-mute">Add boxers to your roster first.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
