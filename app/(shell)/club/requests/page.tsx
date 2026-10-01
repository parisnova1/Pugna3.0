import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { respondToClubEventInvite } from "@/lib/actions/clubEvent";
import { respondToParticipant } from "@/lib/actions/sparring";
import { respondToNomination, respondToClubRequest, respondToClubInvite } from "@/lib/actions/sparringClub";
import { ClubNav } from "@/components/club/ClubNav";
import { formatEventDate } from "@/lib/format";

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

  const [eventInvites, sparringJoinRequests, hostNominations, sparringClubRequests, sparringClubInvites, organizesAnyEvent] =
    await Promise.all([
      prisma.clubEventInvite.findMany({ where: { invitedClubId: clubId, status: "PENDING" }, include: { event: true } }),
      prisma.sparringParticipant.findMany({
        where: { session: { clubId }, status: "REQUESTED" },
        include: { fighter: true, session: true },
      }),
      prisma.sparringNomination.findMany({
        where: { session: { clubId }, status: "PENDING" },
        include: { fighter: true, nominatingClub: true, session: true },
      }),
      prisma.sparringClubRequest.findMany({
        where: { session: { clubId }, status: "PENDING" },
        include: { requestingClub: true, session: true },
      }),
      prisma.sparringClubInvite.findMany({
        where: { invitedClubId: clubId, status: "PENDING" },
        include: { session: true },
      }),
      prisma.event.count({ where: { organizingClubId: clubId } }),
    ]);

  const eventClubRequests = organizesAnyEvent > 0
    ? await prisma.clubEventRequest.findMany({
        where: { event: { organizingClubId: clubId }, status: "PENDING" },
        include: { event: true, requestingClub: true },
      })
    : [];

  const nothingPending =
    eventInvites.length === 0 &&
    sparringJoinRequests.length === 0 &&
    hostNominations.length === 0 &&
    sparringClubRequests.length === 0 &&
    sparringClubInvites.length === 0 &&
    eventClubRequests.length === 0;

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">Requests</h1>
      <ClubNav active="requests" />

      {nothingPending && <p className="text-sm text-mute">Nothing pending.</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Event Invitations</h2>
        {eventInvites.length === 0 ? (
          <p className="text-sm text-mute">No pending event invitations.</p>
        ) : (
          <div className="space-y-2">
            {eventInvites.map((invite) => (
              <RequestCard
                key={invite.id}
                title={invite.event.name}
                subtitle={formatEventDate(invite.event.date)}
                note={invite.message}
                onAccept={async () => {
                  "use server";
                  await respondToClubEventInvite(invite.id, true);
                }}
                onDecline={async () => {
                  "use server";
                  await respondToClubEventInvite(invite.id, false);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Fighter Requests</h2>
        {sparringJoinRequests.length === 0 && hostNominations.length === 0 ? (
          <p className="text-sm text-mute">No pending fighter requests.</p>
        ) : (
          <div className="space-y-2">
            {sparringJoinRequests.map((p) => (
              <RequestCard
                key={p.id}
                title={p.fighter.displayName}
                subtitle={`Wants to join sparring at ${p.session.gym}`}
                onAccept={async () => {
                  "use server";
                  await respondToParticipant(p.id, true);
                }}
                onDecline={async () => {
                  "use server";
                  await respondToParticipant(p.id, false);
                }}
              />
            ))}
            {hostNominations.map((n) => (
              <RequestCard
                key={n.id}
                title={n.fighter.displayName}
                subtitle={`Nominated by ${n.nominatingClub.name} for sparring at ${n.session.gym}`}
                onAccept={async () => {
                  "use server";
                  await respondToNomination(n.id, true);
                }}
                onDecline={async () => {
                  "use server";
                  await respondToNomination(n.id, false);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Sparring Requests</h2>
        {sparringClubRequests.length === 0 ? (
          <p className="text-sm text-mute">No pending sparring requests.</p>
        ) : (
          <div className="space-y-2">
            {sparringClubRequests.map((req) => (
              <RequestCard
                key={req.id}
                title={req.requestingClub.name}
                subtitle={`Wants to join sparring at ${req.session.gym}`}
                onAccept={async () => {
                  "use server";
                  await respondToClubRequest(req.id, true);
                }}
                onDecline={async () => {
                  "use server";
                  await respondToClubRequest(req.id, false);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Club Requests</h2>
        {sparringClubInvites.length === 0 && eventClubRequests.length === 0 ? (
          <p className="text-sm text-mute">No pending club requests.</p>
        ) : (
          <div className="space-y-2">
            {sparringClubInvites.map((invite) => (
              <RequestCard
                key={invite.id}
                title={`Invited to spar at ${invite.session.gym}`}
                subtitle={formatEventDate(invite.session.date)}
                onAccept={async () => {
                  "use server";
                  await respondToClubInvite(invite.id, true);
                }}
                onDecline={async () => {
                  "use server";
                  await respondToClubInvite(invite.id, false);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RequestCard({
  title,
  subtitle,
  note,
  onAccept,
  onDecline,
}: {
  title: string;
  subtitle: string;
  note?: string | null;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  return (
    <div className="rounded-card bg-panel border border-white/10 p-4 space-y-2">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-mute mt-0.5">{subtitle}</p>
        {note && <p className="text-xs text-mute mt-1 italic">&ldquo;{note}&rdquo;</p>}
      </div>
      <div className="flex gap-2">
        <form action={onAccept}>
          <button type="submit" className="rounded-pill bg-signal text-onsignal text-xs font-semibold px-4 py-2">
            Accept
          </button>
        </form>
        <form action={onDecline}>
          <button type="submit" className="rounded-pill border border-white/20 text-xs font-semibold px-4 py-2">
            Decline
          </button>
        </form>
      </div>
    </div>
  );
}
