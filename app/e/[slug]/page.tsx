import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventCardData } from "@/lib/event-query";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { computeRingProjections } from "@/lib/projection";
import { formatEventDate, formatTime, formatDateRange, currentDayNumber } from "@/lib/format";
import { BackButton } from "@/components/event/ContextBar";
import { FollowButton } from "@/components/event/FollowButton";
import { ShareSheet } from "@/components/event/ShareSheet";
import { LiveEventCard, type BoutView } from "@/components/event/LiveEventCard";
import { BracketDiagram, isValidBracket, roundLabelForSize, type BracketRound } from "@/components/event/BracketDiagram";
import { DaySelector } from "@/components/event/overview/DaySelector";
import { WeightClassChips } from "@/components/event/overview/WeightClassChips";
import { RingSection } from "@/components/event/overview/RingSection";
import { ScheduleList } from "@/components/event/overview/ScheduleList";

function weightKg(weightClass: string): number {
  const match = weightClass.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function buildQuery(current: { day?: string; weight?: string }, changes: { day?: string; weight?: string }): string {
  const next = { ...current, ...changes };
  const params = new URLSearchParams();
  if (next.day) params.set("day", next.day);
  if (next.weight) params.set("weight", next.weight);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default async function EventCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ day?: string; weight?: string }>;
}) {
  const { slug } = await params;
  const { day, weight } = await searchParams;
  const data = await getEventCardData(slug);
  if (!data) notFound();

  const { event, projection } = data;
  const actor = await getActor();
  const published = event.status !== "DRAFT" && event.status !== "READY";

  const view = can(actor, "event.view", { eventId: event.id, eventPublished: published });
  if (!view.allowed) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-6 space-y-6">
        <BackButton />
        <div className="pt-12 text-center space-y-2">
          <h1 className="text-xl font-semibold">{event.name}</h1>
          <p className="text-mute text-sm">
            {formatEventDate(event.date)} · {event.venue ?? event.city ?? "TBD"}
          </p>
          <p className="text-mute text-sm pt-4">This event isn&apos;t live yet.</p>
        </div>
      </div>
    );
  }

  const following = actor
    ? Boolean(await prisma.follow.findUnique({ where: { userId_eventId: { userId: actor.userId, eventId: event.id } } }))
    : false;

  const dateLabel = `${formatEventDate(event.date)}${event.startTime ? ` · ${formatTime(event.startTime)}` : ""}`;
  const venueLabel = event.venue ?? event.city ?? "TBD";
  const isSimple = event.ringCount === 1 && event.dayCount === 1;

  const media = await prisma.media.findMany({
    where: { attachedType: "EVENT", attachedId: event.id },
    orderBy: { createdAt: "desc" },
  });
  const coverUrl = media.find((m) => m.kind === "EVENT_COVER")?.url ?? null;
  const galleryUrls = media.filter((m) => m.kind === "EVENT_GALLERY").map((m) => m.url);
  const sponsorUrls = media.filter((m) => m.kind === "SPONSOR").map((m) => m.url);

  const header = (
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
  );

  if (isSimple) {
    const bouts: BoutView[] = event.bouts.map((b) => ({
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

    return (
      <div className="mx-auto w-full max-w-md px-4 pt-4 pb-10">
        {header}
        <LiveEventCard
          slug={slug}
          name={event.name}
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
          coverUrl={coverUrl}
          galleryUrls={galleryUrls}
          sponsorUrls={sponsorUrls}
        />
      </div>
    );
  }

  const defaultDay = currentDayNumber(event.date, event.dayCount);
  const selectedDay = day ? Math.min(Math.max(1, Number(day)), event.dayCount) : defaultDay;
  const dayBouts = event.bouts.filter((b) => b.day === selectedDay);
  const ringProjections = computeRingProjections(event.status, event.rings, dayBouts);
  const boutCountsByDay = Array.from({ length: event.dayCount }, (_, i) =>
    event.bouts.filter((b) => b.day === i + 1 && b.status !== "DRAFT").length,
  );
  const nextBoutIds = new Set(
    Array.from(ringProjections.values())
      .map((p) => p.next?.id)
      .filter((id): id is string => Boolean(id)),
  );
  const liveRing = event.rings.find((r) => ringProjections.get(r.id)?.nowLabel === "LIVE") ?? null;
  const liveNow = liveRing ? ringProjections.get(liveRing.id)?.now ?? null : null;
  const stickyLabel = liveNow ? `LIVE · ${liveNow.weightClass} — ${liveNow.fighterA?.displayName ?? "TBD"} vs ${liveNow.fighterB?.displayName ?? "TBD"}` : null;

  const weightClasses = [...new Set(event.bouts.map((b) => b.weightClass))].sort((a, b) => weightKg(a) - weightKg(b));
  const scheduleBouts = dayBouts.filter((b) => b.status !== "DRAFT" && (!weight || b.weightClass === weight));
  const bracketBouts = [...event.bouts]
    .filter((b) => b.status !== "DRAFT" && (!weight || b.weightClass === weight))
    .sort((a, b) => a.day - b.day || a.number - b.number);

  const rounds: BracketRound[] = [];
  if (weight) {
    const byDay = new Map<number, typeof bracketBouts>();
    for (const b of bracketBouts) byDay.set(b.day, [...(byDay.get(b.day) ?? []), b]);
    for (const d of [...byDay.keys()].sort((a, b) => a - b)) {
      const bouts = byDay.get(d)!;
      rounds.push({
        label: roundLabelForSize(bouts.length),
        bouts: bouts.map((b) => ({
          id: b.id,
          fighterAName: b.fighterA?.displayName ?? null,
          fighterBName: b.fighterB?.displayName ?? null,
          status: b.status,
          resultSummary: b.result ? `${b.result.method}${b.result.round ? ` · Rd ${b.result.round}` : ""}` : null,
          aWon: b.result ? b.result.winnerId === b.fighterAId : null,
        })),
      });
    }
  }
  const showBracket = weight && isValidBracket(rounds);

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 pb-10">
      {header}
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="w-full aspect-video object-cover rounded-card mb-5" />
      )}
      <div className="space-y-1 mb-6">
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-mute text-sm flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <path d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          {venueLabel}
        </p>
        <p className="text-mute text-sm">{formatDateRange(event.date, event.dayCount)}</p>
      </div>

      <DaySelector
        slug={slug}
        dayCount={event.dayCount}
        eventDate={event.date}
        selectedDay={selectedDay}
        boutCounts={boutCountsByDay}
        buildQuery={(changes) => buildQuery({ day, weight }, changes)}
      />

      <div className="space-y-4">
        {event.rings.map((ring) => (
          <RingSection
            key={ring.id}
            slug={slug}
            ring={ring}
            projection={ringProjections.get(ring.id) ?? { now: null, next: null, nowLabel: null }}
            stickyLabel={ring.id === liveRing?.id ? stickyLabel : null}
            eventStreamUrl={event.streamUrl}
          />
        ))}
      </div>

      <div className="mt-8 space-y-3">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Weight classes</p>
        <WeightClassChips
          slug={slug}
          weight={weight}
          weightClasses={weightClasses}
          buildQuery={(changes) => buildQuery({ day, weight }, changes)}
        />

        {showBracket ? (
          <BracketDiagram slug={slug} rounds={rounds} />
        ) : (
          <>
            <p className="text-xs font-semibold text-mute uppercase tracking-wide pt-2">Today&apos;s schedule</p>
            <ScheduleList
              slug={slug}
              bouts={scheduleBouts}
              weightClasses={weight ? [weight] : weightClasses}
              rings={event.rings}
              nextBoutIds={nextBoutIds}
              eventStreamUrl={event.streamUrl}
            />
          </>
        )}
      </div>
    </div>
  );
}
