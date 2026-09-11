import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventCardData } from "@/lib/event-query";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatEventDate, formatTime } from "@/lib/format";
import { BackButton } from "@/components/event/ContextBar";
import { FollowButton } from "@/components/event/FollowButton";
import { ShareSheet } from "@/components/event/ShareSheet";
import { LiveEventCard, type BoutView } from "@/components/event/LiveEventCard";

export default async function RingLiveViewPage({
  params,
}: {
  params: Promise<{ slug: string; ringId: string }>;
}) {
  const { slug, ringId } = await params;
  const data = await getEventCardData(slug, ringId);
  if (!data || !data.ring) notFound();

  const { event, ring, projection, bouts: ringBouts } = data;
  const actor = await getActor();
  const published = event.status !== "DRAFT" && event.status !== "READY";

  const view = can(actor, "event.view", { eventId: event.id, eventPublished: published });
  if (!view.allowed) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-6 space-y-6">
        <BackButton />
        <div className="pt-12 text-center space-y-2">
          <h1 className="text-xl font-semibold">{ring.name ?? `Ring ${ring.number}`}</h1>
          <p className="text-mute text-sm pt-4">This event isn&apos;t live yet.</p>
        </div>
      </div>
    );
  }

  const following = actor
    ? Boolean(await prisma.follow.findUnique({ where: { userId_eventId: { userId: actor.userId, eventId: event.id } } }))
    : false;

  const bouts: BoutView[] = ringBouts.map((b) => ({
    id: b.id,
    number: b.number,
    weightClass: b.weightClass,
    status: b.status,
    delayMinutes: b.delayMinutes,
    winnerName: b.result?.winnerId ? (b.result.winnerId === b.fighterAId ? b.fighterA?.displayName : b.fighterB?.displayName) ?? null : null,
    fighterAName: b.fighterA?.displayName ?? null,
    fighterBName: b.fighterB?.displayName ?? null,
    totalRounds: b.totalRounds,
    currentRound: b.currentRound,
    roundPhase: b.roundPhase,
    phaseEndsAt: b.phaseEndsAt,
    streamUrl: b.streamUrl,
  }));

  const dateLabel = `${formatEventDate(event.date)}${event.startTime ? ` · ${formatTime(event.startTime)}` : ""}`;
  const venueLabel = event.venue ?? event.city ?? "TBD";

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 pb-10">
      <div className="flex items-center justify-between mb-5">
        <BackButton />
        <div className="flex items-center gap-2">
          <ShareSheet code={event.code} name={event.name} />
          <FollowButton eventId={event.id} slug={slug} isGuest={!actor} following={following} />
          <Link href="/account" aria-label="Account" className="rounded-full border border-white/15 p-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
            </svg>
          </Link>
        </div>
      </div>

      {event.ringCount > 1 && (
        <div className="flex gap-2 overflow-x-auto mb-5">
          {event.rings.map((r) => (
            <Link
              key={r.id}
              href={`/e/${slug}/ring/${r.id}`}
              className={[
                "rounded-pill border px-4 py-2 text-sm font-medium whitespace-nowrap",
                r.id === ring.id ? "border-signal bg-signal/10" : "border-white/15 text-mute",
              ].join(" ")}
            >
              {r.name ?? `Ring ${r.number}`}
            </Link>
          ))}
        </div>
      )}

      <LiveEventCard
        slug={slug}
        name={event.name}
        ringId={ring.id}
        ringName={ring.name ?? `Ring ${ring.number}`}
        dateLabel={dateLabel}
        venueLabel={venueLabel}
        streamUrl={event.streamUrl}
        cancelReason={event.cancelReason}
        initialStatus={event.status}
        initialBouts={bouts}
        initialNowLabel={projection.nowLabel}
        initialNowId={projection.now?.id ?? null}
        initialNextId={projection.next?.id ?? null}
        initialFollowerCount={event._count.follows}
        initialIntermissionUntil={event.intermissionUntil}
        initialBreakUntil={ring.breakUntil}
      />
    </div>
  );
}
