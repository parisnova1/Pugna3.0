import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { nominateFighter } from "@/lib/actions/request";
import { requestClubForEvent, respondToClubEventInvite } from "@/lib/actions/clubEvent";
import { ActionForm } from "@/components/host/ActionForm";
import { formatEventDate } from "@/lib/format";
import type { Requirement } from "@/lib/actions/request";
import type { ActionResult } from "@/lib/actions/types";

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

  const [requests, roster, eventInvites, sentRequests, participations] = await Promise.all([
    prisma.eventRequest.findMany({
      where: { clubId, status: { in: ["PENDING", "PARTIAL"] } },
      include: { event: true },
    }),
    prisma.fighterProfile.findMany({ where: { clubId } }),
    prisma.clubEventInvite.findMany({ where: { invitedClubId: clubId, status: "PENDING" }, include: { event: true } }),
    prisma.clubEventRequest.findMany({ where: { requestingClubId: clubId }, include: { event: true } }),
    prisma.clubEventParticipation.findMany({ where: { clubId } }),
  ]);

  const relatedEventIds = new Set([
    ...eventInvites.map((i) => i.eventId),
    ...sentRequests.map((r) => r.eventId),
    ...participations.map((p) => p.eventId),
  ]);
  const invitableEvents = await prisma.event.findMany({
    where: { status: { in: ["PUBLISHED", "READY"] }, id: { notIn: [...relatedEventIds] } },
    orderBy: { date: "asc" },
    take: 30,
  });

  async function requestClubForEventAction(formData: FormData): Promise<ActionResult> {
    "use server";
    const eventId = String(formData.get("eventId") ?? "");
    return requestClubForEvent(eventId, clubId!, formData);
  }

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">Requests</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Event Invitations</h2>
        {eventInvites.length === 0 ? (
          <p className="text-sm text-mute">No pending event invitations.</p>
        ) : (
          <div className="space-y-2">
            {eventInvites.map((invite) => (
              <div key={invite.id} className="rounded-card bg-panel border border-white/10 p-4 space-y-2">
                <div>
                  <p className="text-sm font-medium">{invite.event.name}</p>
                  <p className="text-xs text-mute mt-0.5">{formatEventDate(invite.event.date)}</p>
                  {invite.message && <p className="text-xs text-mute mt-1 italic">&ldquo;{invite.message}&rdquo;</p>}
                </div>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await respondToClubEventInvite(invite.id, true);
                    }}
                  >
                    <button type="submit" className="rounded-pill bg-signal text-onsignal text-xs font-semibold px-4 py-2">
                      Accept
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await respondToClubEventInvite(invite.id, false);
                    }}
                  >
                    <button type="submit" className="rounded-pill border border-white/20 text-xs font-semibold px-4 py-2">
                      Decline
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {invitableEvents.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Request to Join an Event</h2>
          <ActionForm action={requestClubForEventAction} submitLabel="Send request" className="space-y-3">
            <select name="eventId" required className={inputClass}>
              <option value="">Select event</option>
              {invitableEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} — {formatEventDate(event.date)}
                </option>
              ))}
            </select>
            <textarea name="message" rows={2} placeholder="Message (optional)" className={`${inputClass} resize-none`} />
          </ActionForm>
        </section>
      )}

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
