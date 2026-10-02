import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { requestClubForEvent } from "@/lib/actions/clubEvent";
import { getClubRelatedEvents } from "@/lib/club-events";
import { ClubNav } from "@/components/club/ClubNav";
import { ClubEventListItem } from "@/components/club/ClubEventListItem";
import { formatEventDate } from "@/lib/format";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

type Tab = "discover" | "mine";

export default async function ClubEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string; tab?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club/events");

  const { club: requestedClubId, tab } = await searchParams;
  const clubId = requestedClubId && actor.clubIds.includes(requestedClubId) ? requestedClubId : actor.clubIds[0];
  if (!clubId) redirect("/club");

  const activeTab: Tab = tab === "mine" ? "mine" : "discover";

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">Events</h1>
      <ClubNav active="events" />

      <nav className="flex gap-2 text-sm">
        <Link
          href="/club/events?tab=discover"
          className={`rounded-pill border px-4 py-2 font-medium ${activeTab === "discover" ? "border-signal bg-signal/10" : "border-white/15 text-mute"}`}
        >
          Discover
        </Link>
        <Link
          href="/club/events?tab=mine"
          className={`rounded-pill border px-4 py-2 font-medium ${activeTab === "mine" ? "border-signal bg-signal/10" : "border-white/15 text-mute"}`}
        >
          My Events
        </Link>
      </nav>

      {activeTab === "discover" ? <DiscoverTab clubId={clubId} /> : <MyEventsTab clubId={clubId} />}
    </div>
  );
}

async function DiscoverTab({ clubId }: { clubId: string }) {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: { status: { in: ["PUBLISHED", "LIVE", "INTERMISSION"] }, date: { gte: now } },
    orderBy: { date: "asc" },
    take: 30,
    include: { organizingClub: true, createdBy: { include: { organizerProfile: true } } },
  });

  const eventIds = events.map((e) => e.id);
  const [participations, invites, requests] =
    eventIds.length > 0
      ? await Promise.all([
          prisma.clubEventParticipation.findMany({ where: { clubId, eventId: { in: eventIds } }, select: { eventId: true } }),
          prisma.clubEventInvite.findMany({ where: { invitedClubId: clubId, eventId: { in: eventIds }, status: "PENDING" }, select: { eventId: true } }),
          prisma.clubEventRequest.findMany({ where: { requestingClubId: clubId, eventId: { in: eventIds }, status: "PENDING" }, select: { eventId: true } }),
        ])
      : [[], [], []];

  const participating = new Set(participations.map((p) => p.eventId));
  const invited = new Set(invites.map((i) => i.eventId));
  const requested = new Set(requests.map((r) => r.eventId));

  async function requestToJoin(formData: FormData) {
    "use server";
    const eventId = String(formData.get("eventId") ?? "");
    await requestClubForEvent(eventId, clubId, formData);
  }

  if (events.length === 0) {
    return <EmptyState>No public events right now.</EmptyState>;
  }

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const organizerName = event.organizingClub?.name ?? event.createdBy.organizerProfile?.displayName ?? "PUGNA";
        const status = participating.has(event.id) ? "Participating" : invited.has(event.id) ? "Invited" : requested.has(event.id) ? "Requested" : null;

        return (
          <div key={event.id} className="rounded-card bg-panel border border-white/10 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm truncate">{event.name}</p>
              <span className="text-xs text-mute shrink-0">{formatEventDate(event.date)}</span>
            </div>
            <p className="text-xs text-mute">
              {[event.venue, event.city].filter(Boolean).join(" · ") || "TBD"} · {event.sport} · {organizerName}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Link
                href={event.slug ? `/e/${event.slug}` : "#"}
                className={buttonClass({ variant: "outline", size: "xxs", text: "xs", className: "px-3" })}
              >
                View Event
              </Link>
              {status ? (
                <span className="text-xs text-mute font-medium">{status}</span>
              ) : (
                <form action={requestToJoin}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <Button type="submit" size="xxs" text="xs" className="px-3">
                    Request to Join
                  </Button>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

async function MyEventsTab({ clubId }: { clubId: string }) {
  const [relatedEvents, pendingInvites] = await Promise.all([
    getClubRelatedEvents(clubId),
    prisma.clubEventInvite.findMany({ where: { invitedClubId: clubId, status: "PENDING" }, include: { event: true } }),
  ]);

  const relatedIds = new Set(relatedEvents.map((e) => e.id));
  const invitedOnly = pendingInvites
    .filter((invite) => !relatedIds.has(invite.eventId))
    .map((invite) => ({
      id: invite.event.id,
      slug: invite.event.slug,
      name: invite.event.name,
      date: invite.event.date,
      venue: invite.event.venue,
      city: invite.event.city,
      coverUrl: null,
      statusLabel: "Invited",
      nominatedCount: 0,
      isOrganizing: false,
    }));

  const items = [...relatedEvents, ...invitedOnly].sort((a, b) => a.date.getTime() - b.date.getTime());

  if (items.length === 0) {
    return <EmptyState>No events yet — find one under Discover.</EmptyState>;
  }

  return (
    <div className="space-y-2">
      {items.map((event) => (
        <ClubEventListItem key={event.id} event={event} />
      ))}
    </div>
  );
}
