import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { formatEventDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { ClubAvatar } from "@/components/clubs/ClubCard";
import { ClubFollowButton } from "@/components/clubs/ClubFollowButton";
import { JoinClubButton } from "@/components/clubs/JoinClubButton";
import { EventPreviewCard } from "@/components/event/EventPreviewCard";
import { MediaUploader } from "@/components/host/MediaUploader";
import { BackButton } from "@/components/event/ContextBar";

export default async function ClubProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const club = await prisma.club.findUnique({
    where: { id },
    include: {
      _count: { select: { roster: true, coaches: true } },
      roster: { take: 8, orderBy: { displayName: "asc" } },
      coaches: { take: 8, orderBy: { displayName: "asc" } },
      organizedEvents: {
        where: { status: { in: ["PUBLISHED", "LIVE", "INTERMISSION"] } },
        orderBy: { date: "asc" },
        take: 3,
      },
      sparringSessions: {
        where: { status: "OPEN", date: { gte: new Date() } },
        orderBy: { date: "asc" },
        take: 3,
        include: { weightGroups: { orderBy: { order: "asc" }, take: 1 } },
      },
    },
  });

  if (!club) notFound();

  const actor = await getActor();
  const canEdit = can(actor, "club.admin", { clubId: club.id }).allowed;

  const [cover, following, fighter, recentResults] = await Promise.all([
    prisma.media.findFirst({ where: { attachedType: "CLUB", attachedId: club.id, kind: "CLUB_COVER" }, orderBy: { createdAt: "desc" } }),
    actor
      ? prisma.clubFollow.findUnique({ where: { userId_clubId: { userId: actor.userId, clubId: club.id } } })
      : Promise.resolve(null),
    actor ? prisma.fighterProfile.findUnique({ where: { userId: actor.userId } }) : Promise.resolve(null),
    prisma.bout.findMany({
      where: { OR: [{ fighterA: { clubId: club.id } }, { fighterB: { clubId: club.id } }], status: "FINAL" },
      include: { fighterA: true, fighterB: true, result: true, event: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  const metaLine = [club.city, club.sport].filter(Boolean).join(" · ");

  return (
    <div className="space-y-8 pb-4">
      <BackButton />

      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <ClubAvatar name={club.name} coverUrl={cover?.url ?? null} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold leading-tight">{club.name}</h1>
            {metaLine && <p className="text-mute text-sm mt-0.5">{metaLine}</p>}
            {club.isVerified && (
              <div className="mt-1.5">
                <Badge tone="signal">✓ PUGNA Verified</Badge>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <ClubFollowButton clubId={club.id} isGuest={!actor} following={Boolean(following)} />
          <JoinClubButton
            clubId={club.id}
            isGuest={!actor}
            hasFighterProfile={Boolean(fighter)}
            isMember={fighter?.clubId === club.id}
            inAnotherClub={Boolean(fighter?.clubId) && fighter?.clubId !== club.id}
          />
        </div>

        {canEdit && (
          <MediaUploader kind="CLUB_COVER" attachedType="CLUB" attachedId={club.id} label={cover ? "Replace cover" : "Add club cover"} />
        )}
      </div>

      {club.description && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">About</p>
          <p className="text-sm text-ink leading-relaxed">{club.description}</p>
        </section>
      )}

      {(club._count.roster > 0 || club._count.coaches > 0) && (
        <section className="grid grid-cols-2 gap-2">
          {club._count.roster > 0 && (
            <div className="rounded-card bg-panel border border-white/10 p-3 text-center">
              <p className="text-lg font-semibold tabular">{club._count.roster}</p>
              <p className="text-[11px] text-mute mt-0.5">Boxers</p>
            </div>
          )}
          {club._count.coaches > 0 && (
            <div className="rounded-card bg-panel border border-white/10 p-3 text-center">
              <p className="text-lg font-semibold tabular">{club._count.coaches}</p>
              <p className="text-[11px] text-mute mt-0.5">Coaches</p>
            </div>
          )}
        </section>
      )}

      {club.organizedEvents.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Upcoming Events</p>
          <div className="space-y-3">
            {club.organizedEvents.map((event) => (
              <EventPreviewCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Fighters</p>
        {club.roster.length === 0 ? (
          <p className="text-sm text-mute">No boxers listed yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {club.roster.map((rosterFighter) => (
              <Link
                key={rosterFighter.id}
                href={`/fighters/${rosterFighter.id}`}
                className="rounded-card bg-panel border border-white/10 p-3"
              >
                <p className="text-sm font-medium">{rosterFighter.displayName}</p>
                <p className="text-xs text-mute">{rosterFighter.weightClass ?? "—"}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {club.coaches.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Coaches</p>
          <div className="grid grid-cols-2 gap-2">
            {club.coaches.map((coach) => (
              <div key={coach.id} className="rounded-card bg-panel border border-white/10 p-3">
                <p className="text-sm font-medium">{coach.displayName}</p>
                {coach.bio && <p className="text-xs text-mute mt-0.5 line-clamp-2">{coach.bio}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {club.sparringSessions.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Sparring</p>
          <div className="space-y-2">
            {club.sparringSessions.map((session) => (
              <Link
                key={session.id}
                href={`/sparring/${session.id}`}
                className="block rounded-card bg-panel border border-white/10 p-4 hover:border-white/20 transition-colors"
              >
                <p className="font-semibold text-sm">{session.gym}</p>
                <p className="text-xs text-mute mt-1">
                  {formatEventDate(session.date)}
                  {session.weightGroups[0] ? ` · ${session.weightGroups[0].label}` : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recentResults.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Results</p>
          <div className="space-y-2">
            {recentResults.map((bout) => {
              if (!bout.event.slug) return null;
              const winnerName =
                bout.result?.winnerId === bout.fighterAId
                  ? bout.fighterA?.displayName
                  : bout.result?.winnerId === bout.fighterBId
                    ? bout.fighterB?.displayName
                    : null;
              return (
                <Link
                  key={bout.id}
                  href={`/e/${bout.event.slug}/bout/${bout.id}`}
                  className="block rounded-card bg-panel border border-white/10 p-4 hover:border-white/20 transition-colors"
                >
                  <p className="text-sm font-medium">
                    {bout.fighterA?.displayName ?? "TBD"} <span className="text-mute font-normal">vs</span>{" "}
                    {bout.fighterB?.displayName ?? "TBD"}
                  </p>
                  <p className="text-xs text-mute mt-0.5">
                    {bout.event.name}
                    {winnerName ? ` · ${winnerName} won` : ""}
                    {bout.result?.method ? ` · ${bout.result.method}` : ""}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
