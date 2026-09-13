import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatEventDate } from "@/lib/format";
import { ClubAvatar } from "@/components/clubs/ClubCard";
import { cancelClubEventInvite, respondToClubEventRequest } from "@/lib/actions/clubEvent";
import type { Actor } from "@/lib/rbac";

type Tab = "discover" | "mine" | "requests";

/**
 * The Organizer's Clubs experience — Find -> View -> Invite -> Accept ->
 * Participate. Rendered instead of the public clubs directory for anyone
 * with `actor.isOrganizer`; the viewer page underneath is untouched — same
 * branch pattern as OrganizerHome on /events.
 */
export async function OrganizerClubs({
  actor,
  searchParams,
}: {
  actor: NonNullable<Actor>;
  searchParams: { tab?: string; q?: string };
}) {
  const tab: Tab = searchParams.tab === "mine" || searchParams.tab === "requests" ? searchParams.tab : "discover";
  const eventIds = Object.keys(actor.hostRoles);

  return (
    <div className="space-y-6 pb-4">
      <div className="pt-2 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Clubs</h1>
          <p className="text-mute text-sm">Find clubs, invite them to your events, and manage your club connections.</p>
        </div>
        <Link href="/" aria-label="Go to PUGNA home" className="font-bold tracking-tight text-sm shrink-0">
          PUGNA<span className="text-signal">.</span>
        </Link>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-1">
        <TabLink tab="discover" current={tab}>
          Discover
        </TabLink>
        <TabLink tab="mine" current={tab}>
          My Clubs
        </TabLink>
        <TabLink tab="requests" current={tab}>
          Requests
        </TabLink>
      </nav>

      {tab === "discover" && <DiscoverTab q={searchParams.q} eventIds={eventIds} />}
      {tab === "mine" && <MyClubsTab eventIds={eventIds} />}
      {tab === "requests" && <RequestsTab eventIds={eventIds} />}
    </div>
  );
}

function TabLink({ tab, current, children }: { tab: Tab; current: Tab; children: React.ReactNode }) {
  return (
    <Link
      href={`/clubs?tab=${tab}`}
      className={[
        "shrink-0 rounded-pill px-4 py-2 text-sm font-medium border",
        current === tab ? "bg-ink text-void border-ink" : "border-white/15 text-mute",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-14 space-y-1">
      <p className="text-sm text-mute">{text}</p>
    </div>
  );
}

async function DiscoverTab({ q, eventIds }: { q?: string; eventIds: string[] }) {
  const clubs = await prisma.club.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] } : {},
    include: { _count: { select: { roster: true } } },
    orderBy: { name: "asc" },
    take: 40,
  });

  const clubIds = clubs.map((c) => c.id);
  const [participations, invites, requests] =
    clubIds.length > 0 && eventIds.length > 0
      ? await Promise.all([
          prisma.clubEventParticipation.findMany({ where: { clubId: { in: clubIds }, eventId: { in: eventIds } }, select: { clubId: true } }),
          prisma.clubEventInvite.findMany({
            where: { invitedClubId: { in: clubIds }, eventId: { in: eventIds }, status: "PENDING" },
            select: { invitedClubId: true },
          }),
          prisma.clubEventRequest.findMany({
            where: { requestingClubId: { in: clubIds }, eventId: { in: eventIds }, status: "PENDING" },
            select: { requestingClubId: true },
          }),
        ])
      : [[], [], []];

  const connected = new Set(participations.map((p) => p.clubId));
  const invited = new Set(invites.map((i) => i.invitedClubId));
  const requested = new Set(requests.map((r) => r.requestingClubId));

  return (
    <div className="space-y-3">
      <form className="relative">
        <input type="hidden" name="tab" value="discover" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search clubs by name or city..."
          className="w-full rounded-card bg-panel border border-white/10 px-4 py-3.5 text-ink placeholder:text-mute"
        />
      </form>

      {clubs.length === 0 ? (
        <Empty text="No clubs found." />
      ) : (
        <div className="space-y-2">
          {clubs.map((club) => (
            <Link
              key={club.id}
              href={`/clubs/${club.id}`}
              className="flex items-center justify-between gap-3 rounded-card bg-panel border border-white/10 p-4 hover:border-white/20 transition-colors"
            >
              <div className="flex gap-3 items-center min-w-0">
                <ClubAvatar name={club.name} coverUrl={null} size={44} />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {club.name}
                    {club.isVerified ? " ✓" : ""}
                  </p>
                  <p className="text-xs text-mute mt-0.5 truncate">
                    {[club.city, club.sport].filter(Boolean).join(" · ")} · {club._count.roster} boxer
                    {club._count.roster === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <span className="text-xs shrink-0 font-medium text-mute">
                {connected.has(club.id) ? "Connected" : invited.has(club.id) ? "Invited" : requested.has(club.id) ? "Requested" : "View →"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

async function MyClubsTab({ eventIds }: { eventIds: string[] }) {
  if (eventIds.length === 0) return <Empty text="Host an event to start connecting with clubs." />;

  const participations = await prisma.clubEventParticipation.findMany({
    where: { eventId: { in: eventIds } },
    include: { club: true },
    orderBy: { createdAt: "desc" },
  });

  const byClub = new Map<string, { name: string; eventCount: number }>();
  for (const p of participations) {
    const entry = byClub.get(p.clubId) ?? { name: p.club.name, eventCount: 0 };
    entry.eventCount += 1;
    byClub.set(p.clubId, entry);
  }

  const clubs = [...byClub.entries()];

  return clubs.length === 0 ? (
    <Empty text="No connected clubs yet — invite one from Discover." />
  ) : (
    <div className="space-y-2">
      {clubs.map(([clubId, { name, eventCount }]) => (
        <Link key={clubId} href={`/clubs/${clubId}`} className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4">
          <div>
            <p className="font-semibold text-sm">{name}</p>
            <p className="text-xs text-mute mt-0.5">
              {eventCount} event{eventCount === 1 ? "" : "s"} together
            </p>
          </div>
          <span className="text-xs text-signal shrink-0">View →</span>
        </Link>
      ))}
    </div>
  );
}

async function RequestsTab({ eventIds }: { eventIds: string[] }) {
  if (eventIds.length === 0) return <Empty text="Host an event to send or receive club requests." />;

  const [sent, received] = await Promise.all([
    prisma.clubEventInvite.findMany({
      where: { eventId: { in: eventIds }, status: "PENDING" },
      include: { invitedClub: true, event: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clubEventRequest.findMany({
      where: { eventId: { in: eventIds }, status: "PENDING" },
      include: { requestingClub: true, event: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Sent</p>
        {sent.length === 0 ? (
          <p className="text-sm text-mute">No pending invitations.</p>
        ) : (
          <div className="space-y-2">
            {sent.map((invite) => (
              <div key={invite.id} className="rounded-card bg-panel border border-white/10 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{invite.invitedClub.name}</p>
                  <p className="text-xs text-mute mt-0.5 truncate">
                    Invited to {invite.event.name} · {formatEventDate(invite.event.date)}
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await cancelClubEventInvite(invite.id);
                  }}
                >
                  <button type="submit" className="shrink-0 text-xs text-mute underline">
                    Cancel
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Received</p>
        {received.length === 0 ? (
          <p className="text-sm text-mute">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {received.map((req) => (
              <div key={req.id} className="rounded-card bg-panel border border-white/10 p-4 space-y-2">
                <div>
                  <p className="text-sm font-medium">{req.requestingClub.name}</p>
                  <p className="text-xs text-mute mt-0.5">
                    Wants to participate in {req.event.name} · {formatEventDate(req.event.date)}
                  </p>
                  {req.message && <p className="text-xs text-mute mt-1 italic">&ldquo;{req.message}&rdquo;</p>}
                </div>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await respondToClubEventRequest(req.id, true);
                    }}
                  >
                    <button type="submit" className="rounded-pill bg-signal text-onsignal text-xs font-semibold px-4 py-2">
                      Accept
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await respondToClubEventRequest(req.id, false);
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
    </div>
  );
}
