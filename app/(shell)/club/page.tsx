import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { createClub, claimClub } from "@/lib/actions/club";
import { createEventFromClub } from "@/lib/actions/event";
import { getClubRelatedEvents } from "@/lib/club-events";
import { ActionForm } from "@/components/host/ActionForm";
import { BellLink } from "@/components/nav/BellLink";
import { ClubNav } from "@/components/club/ClubNav";
import { ClubEventListItem } from "@/components/club/ClubEventListItem";
import { NominateFighterFlow } from "@/components/club/NominateFighterFlow";
import { ClubAvatar } from "@/components/clubs/ClubCard";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

export default async function ClubHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; club?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club");

  const { club: requestedClubId } = await searchParams;
  const activeClubId =
    requestedClubId && actor.clubIds.includes(requestedClubId) ? requestedClubId : actor.clubIds[0];

  const myClub = activeClubId ? await prisma.club.findUnique({ where: { id: activeClubId } }) : null;

  if (myClub) {
    const [unreadCount, cover, upcomingEvents, relatedEvents, fighters] = await Promise.all([
      prisma.notification.count({ where: { userId: actor.userId, read: false } }),
      prisma.media.findFirst({ where: { attachedType: "CLUB", attachedId: myClub.id, kind: "CLUB_COVER" }, orderBy: { createdAt: "desc" } }),
      getClubRelatedEvents(myClub.id, { upcomingOnly: true, take: 5 }),
      getClubRelatedEvents(myClub.id),
      prisma.fighterProfile.findMany({ where: { clubId: myClub.id }, select: { id: true, displayName: true, weightClass: true } }),
    ]);

    const fighterOptions = fighters.map((f) => ({ id: f.id, name: f.displayName, weightClass: f.weightClass }));

    return (
      <div className="space-y-6 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClubAvatar name={myClub.name} coverUrl={cover?.url ?? null} size={48} />
            <div>
              <h1 className="text-xl font-semibold leading-tight">{myClub.name}</h1>
              {myClub.isVerified && (
                <div className="mt-1">
                  <Badge tone="success">✓ PUGNA Verified</Badge>
                </div>
              )}
            </div>
          </div>
          <BellLink unreadCount={unreadCount} />
        </div>

        <ClubNav active="home" />

        <form
          action={async () => {
            "use server";
            await createEventFromClub(myClub.id);
          }}
        >
          <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3.5">
            + Create Event
          </button>
        </form>

        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Upcoming Events</p>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-mute">No upcoming events yet.</p>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <ClubEventListItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Quick actions</p>
          <div className="grid grid-cols-2 gap-2">
            <NominateFighterFlow
              clubId={myClub.id}
              events={relatedEvents}
              fighters={fighterOptions}
              triggerClassName="w-full rounded-card bg-panel border border-white/10 p-3 text-center text-sm font-semibold"
            />
            <Link href="/club/events?tab=discover" className="rounded-card bg-panel border border-white/10 p-3 text-center text-sm font-semibold">
              Find Event
            </Link>
            <Link href="/sparring/host/new" className="rounded-card bg-panel border border-white/10 p-3 text-center text-sm font-semibold">
              Create Sparring
            </Link>
            <Link href="/club/requests" className="rounded-card bg-panel border border-white/10 p-3 text-center text-sm font-semibold">
              View Requests
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const { q } = await searchParams;
  const clubs = q
    ? await prisma.club.findMany({ where: { name: { contains: q, mode: "insensitive" } }, include: { admins: true }, take: 10 })
    : [];

  return (
    <div className="space-y-8 pt-2">
      <h1 className="text-2xl font-semibold">Club</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Create</h2>
        <ActionForm action={createClub} submitLabel="Create club" className="space-y-3">
          <input name="name" placeholder="Club name" required className={inputClass} />
          <input name="city" placeholder="City" className={inputClass} />
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Claim</h2>
        <form className="relative">
          <input name="q" defaultValue={q} placeholder="Search clubs" className={inputClass} />
        </form>
        {clubs.map((club) => (
          <div key={club.id} className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{club.name}</p>
              <p className="text-xs text-mute">{club.admins.length > 0 ? "Claimed" : "Unclaimed"}</p>
            </div>
            {club.admins.length === 0 && (
              <form
                action={async () => {
                  "use server";
                  await claimClub(club.id);
                }}
              >
                <button type="submit" className="rounded-pill border border-white/20 px-3 py-1.5 text-xs font-medium">
                  Claim
                </button>
              </form>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
