import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { deleteMedia } from "@/lib/actions/media";
import { hideShout, muteUser } from "@/lib/actions/crowd";
import { getCrowdSnapshot, getMyReactions } from "@/lib/crowd-query";
import { MediaUploader } from "@/components/host/MediaUploader";
import { BackButton } from "@/components/event/ContextBar";
import { NotifyButton } from "@/components/event/NotifyButton";
import { SaveBoutButton } from "@/components/live/SaveBoutButton";
import { BoutLiveClient } from "@/components/live/BoutLiveClient";
import type { BoutStatus } from "@prisma/client";

// A fight is "upcoming" — worth notifying about — before it's live and before it's over.
const UPCOMING_STATUSES: BoutStatus[] = ["TBD", "CONFIRMED", "READY"];

export default async function BoutDetailPage({
  params,
}: {
  params: Promise<{ slug: string; boutId: string }>;
}) {
  const { slug, boutId } = await params;

  const bout = await prisma.bout.findUnique({
    where: { id: boutId },
    include: {
      event: { include: { _count: { select: { follows: true } } } },
      fighterA: { include: { club: true } },
      fighterB: { include: { club: true } },
      result: true,
    },
  });

  if (!bout || bout.event.slug !== slug) notFound();

  const actor = await getActor();
  const published = bout.event.status !== "DRAFT" && bout.event.status !== "READY";
  const view = can(actor, "event.view", { eventId: bout.event.id, eventPublished: published });
  if (!view.allowed) notFound();

  const canEdit = can(actor, "event.edit", { eventId: bout.event.id }).allowed;
  const [media, snapshot, myReactions, checkIn, mute, moderationShouts] = await Promise.all([
    prisma.media.findMany({ where: { attachedType: "BOUT", attachedId: bout.id }, orderBy: { createdAt: "desc" } }),
    getCrowdSnapshot(bout.id),
    actor ? getMyReactions(bout.id, actor.userId) : Promise.resolve([]),
    actor
      ? prisma.eventCheckIn.findUnique({ where: { eventId_userId: { eventId: bout.eventId, userId: actor.userId } } })
      : Promise.resolve(null),
    actor
      ? prisma.crowdMute.findUnique({ where: { eventId_userId: { eventId: bout.eventId, userId: actor.userId } } })
      : Promise.resolve(null),
    canEdit
      ? prisma.crowdShout.findMany({
          where: { boutId: bout.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { user: true },
        })
      : Promise.resolve([]),
  ]);

  const isUpcoming = UPCOMING_STATUSES.includes(bout.status);
  const [followRow, savedRow] = await Promise.all([
    actor
      ? prisma.follow.findUnique({ where: { userId_eventId: { userId: actor.userId, eventId: bout.event.id } } })
      : Promise.resolve(null),
    actor
      ? prisma.savedBout.findUnique({ where: { userId_boutId: { userId: actor.userId, boutId: bout.id } } })
      : Promise.resolve(null),
  ]);
  const following = Boolean(followRow);
  const saved = Boolean(savedRow);

  const writeGate = can(actor, "crowd.write", {
    checkedIn: Boolean(checkIn),
    boutInProgress: bout.status === "IN_PROGRESS",
    muted: Boolean(mute),
  });

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 pb-10 space-y-6">
      <div className="flex items-center justify-between">
        <BackButton />
        <div className="flex items-center gap-2">
          <SaveBoutButton boutId={bout.id} returnTo={`/e/${slug}/bout/${bout.id}`} isGuest={!actor} saved={saved} />
          {isUpcoming && (
            <NotifyButton
              eventId={bout.event.id}
              slug={slug}
              returnTo={`/e/${slug}/bout/${bout.id}`}
              isGuest={!actor}
              following={following}
            />
          )}
        </div>
      </div>

      <BoutLiveClient
        boutId={bout.id}
        slug={slug}
        isGuest={!actor}
        number={bout.number}
        weightClass={bout.weightClass}
        fighterAId={bout.fighterAId}
        fighterBId={bout.fighterBId}
        fighterAName={bout.fighterA?.displayName ?? "TBD"}
        fighterBName={bout.fighterB?.displayName ?? "TBD"}
        fighterAClub={bout.fighterA?.club?.name ?? null}
        fighterBClub={bout.fighterB?.club?.name ?? null}
        initial={{
          status: bout.status,
          delayMinutes: bout.delayMinutes,
          streamUrl: bout.streamUrl,
          eventStreamUrl: bout.event.streamUrl,
          totalRounds: bout.totalRounds,
          currentRound: bout.currentRound,
          roundPhase: bout.roundPhase,
          phaseEndsAt: bout.phaseEndsAt ? bout.phaseEndsAt.toISOString() : null,
          result: bout.result
            ? { winnerId: bout.result.winnerId, method: bout.result.method, round: bout.result.round }
            : null,
          reactionCounts: snapshot.reactionCounts,
          shouts: snapshot.shouts.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
          crowdSize: snapshot.crowdSize,
          myReactions,
          checkedIn: Boolean(checkIn),
          canWrite: writeGate.allowed,
          followerCount: bout.event._count.follows,
          updatedAt: new Date().toISOString(),
        }}
      />

      {(media.length > 0 || canEdit) && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Photos</p>
          {media.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {media.map((m) => (
                <div key={m.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" className="w-full aspect-square object-cover rounded-card" />
                  {canEdit && (
                    <form
                      action={async () => {
                        "use server";
                        await deleteMedia(m.id);
                      }}
                      className="absolute top-1 right-1"
                    >
                      <button
                        type="submit"
                        aria-label="Delete"
                        className="flex items-center justify-center w-5 h-5 text-xs rounded-full bg-black/70 text-ink"
                      >
                        ×
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
          {canEdit && <MediaUploader kind="BOUT_MEDIA" attachedType="BOUT" attachedId={bout.id} label="Add photo" />}
        </div>
      )}

      {canEdit && moderationShouts.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Moderate crowd</p>
          {moderationShouts.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-card border border-white/10 px-3 py-2">
              <div className="min-w-0">
                <p className={`text-sm truncate ${s.hidden ? "text-mute line-through" : ""}`}>&ldquo;{s.text}&rdquo;</p>
                <p className="text-[11px] text-mute truncate">{s.user.name ?? s.user.email}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {!s.hidden && (
                  <form action={async () => { "use server"; await hideShout(s.id, bout.eventId); }}>
                    <button type="submit" className="text-xs font-medium text-mute underline">
                      Hide
                    </button>
                  </form>
                )}
                <form action={async () => { "use server"; await muteUser(bout.eventId, s.userId); }}>
                  <button type="submit" className="text-xs font-medium text-signal underline">
                    Mute
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
