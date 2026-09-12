import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventCardData } from "@/lib/event-query";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { computeRingProjections, isEventLive } from "@/lib/projection";
import { formatEventDate, formatTime, formatDateRange, currentDayNumber } from "@/lib/format";
import { BackButton } from "@/components/event/ContextBar";
import { FollowButton } from "@/components/event/FollowButton";
import { ShareSheet } from "@/components/event/ShareSheet";
import { LiveEventCard, type BoutView } from "@/components/event/LiveEventCard";
import { eventStatusPillFor } from "@/lib/bout-status";
import { BracketDiagram, isValidBracket, roundLabelForSize, type BracketRound } from "@/components/event/BracketDiagram";
import { DaySelector } from "@/components/event/overview/DaySelector";
import { WeightClassChips } from "@/components/event/overview/WeightClassChips";
import { RingSection } from "@/components/event/overview/RingSection";
import { ScheduleList } from "@/components/event/overview/ScheduleList";
import { ResultsList } from "@/components/event/overview/ResultsList";
import { ScheduleResultsToggle } from "@/components/event/overview/ScheduleResultsToggle";
import { EventTabs } from "@/components/event/EventTabs";
import { LiveAudience } from "@/components/event/LiveAudience";
import { Badge } from "@/components/ui/Badge";

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

  const [checkedInCount, viewerCheckIn] = await Promise.all([
    prisma.eventCheckIn.count({ where: { eventId: event.id } }),
    actor
      ? prisma.eventCheckIn.findUnique({ where: { eventId_userId: { eventId: event.id, userId: actor.userId } } })
      : Promise.resolve(null),
  ]);

  const organizerName = event.organizingClub?.name ?? event.createdBy.organizerProfile?.displayName ?? null;
  const organizerHref = event.organizingClub ? `/clubs/${event.organizingClub.id}` : null;
  const directionsHref =
    event.latitude != null && event.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`
      : null;

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

    const finalBouts = event.bouts.filter((b) => b.status === "FINAL");
    const liveBoutId = projection.nowLabel === "LIVE" ? (projection.now?.id ?? null) : null;
    const pill = eventStatusPillFor(event.status, projection.nowLabel);

    const tabs = [
      { id: "overview", label: "Overview" },
      { id: "live", label: "Live" },
      { id: "card", label: "Card" },
      ...(finalBouts.length > 0 ? [{ id: "results", label: "Results" }] : []),
      { id: "info", label: "Info" },
    ];

    return (
      <div className="mx-auto w-full max-w-md lg:max-w-5xl px-4 pt-4 pb-10">
        <div id="overview" className="scroll-mt-24">
          <div className="flex items-center justify-between mb-4">
            <BackButton fallbackHref="/events" />
            <Link href="/" aria-label="Go to PUGNA home" className="font-bold tracking-tight text-sm shrink-0">
              PUGNA<span className="text-signal">.</span>
            </Link>
          </div>

          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="w-full aspect-video object-cover rounded-card mb-4" />
          )}

          <div className="space-y-1.5 mb-4">
            {pill && (
              <div className="flex items-center gap-2">
                <Badge live={pill.live} tone={pill.live ? "live" : "neutral"}>
                  {pill.text}
                </Badge>
                {event._count.follows > 0 && (
                  <span className="text-[11px] text-mute tabular">
                    {new Intl.NumberFormat("en-US").format(event._count.follows)} watching
                  </span>
                )}
              </div>
            )}
            <h1 className="text-2xl font-semibold">{event.name}</h1>
            <p className="text-mute text-sm">{venueLabel}</p>
            <p className="text-mute text-sm">{dateLabel}</p>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <FollowButton eventId={event.id} slug={slug} isGuest={!actor} following={following} />
            <ShareSheet code={event.code} name={event.name} />
            <Link href="/account" aria-label="Account" className="rounded-full border border-white/15 p-2.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
              </svg>
            </Link>
            {event.status === "CANCELLED" && event.cancelReason && (
              <p className="text-sm text-error">Cancelled: {event.cancelReason}</p>
            )}
          </div>

          <EventTabs tabs={tabs} />
        </div>

        <div className="mt-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
          <div id="live" className="lg:col-span-2 space-y-6 scroll-mt-24">
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
              galleryUrls={galleryUrls}
              sponsorUrls={sponsorUrls}
              hideHeader
              eventId={event.id}
              isGuest={!actor}
              following={following}
              fullCardId="card"
            />
          </div>

          <div className="mt-6 lg:mt-0 space-y-4">
            <LiveAudience
              slug={slug}
              checkedInCount={checkedInCount}
              viewerCheckedIn={Boolean(viewerCheckIn)}
              liveBoutId={liveBoutId}
            />

            <div id="info" className="scroll-mt-24 space-y-4">
              <div className="rounded-card bg-panel border border-white/10 p-5 space-y-3">
                <p className="text-xs font-semibold text-mute uppercase tracking-wide">Event Info</p>
                {(event.venue || event.city) && (
                  <div>
                    <p className="text-xs text-mute">Venue</p>
                    <p className="text-sm font-medium">{venueLabel}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-mute">Date</p>
                  <p className="text-sm font-medium">{formatEventDate(event.date)}</p>
                </div>
                {event.startTime && (
                  <div>
                    <p className="text-xs text-mute">Start</p>
                    <p className="text-sm font-medium">{formatTime(event.startTime)}</p>
                  </div>
                )}
                {directionsHref && (
                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-pill border border-white/20 text-ink text-sm font-medium px-4 py-2"
                  >
                    Directions
                  </a>
                )}
              </div>

              {organizerName && (
                <div className="rounded-card bg-panel border border-white/10 p-5 space-y-2">
                  <p className="text-xs font-semibold text-mute uppercase tracking-wide">Organized by</p>
                  {organizerHref ? (
                    <Link href={organizerHref} className="text-sm font-semibold text-signal">
                      {organizerName} →
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold">{organizerName}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {finalBouts.length > 0 && (
          <div id="results" className="mt-8 space-y-3 scroll-mt-24">
            <p className="text-xs font-semibold text-mute uppercase tracking-wide">Results</p>
            <div className="space-y-2">
              {finalBouts.map((bout) => {
                const winnerName = bout.result?.winnerId
                  ? bout.result.winnerId === bout.fighterAId
                    ? bout.fighterA?.displayName
                    : bout.fighterB?.displayName
                  : null;
                return (
                  <Link
                    key={bout.id}
                    href={`/e/${slug}/bout/${bout.id}`}
                    className="block rounded-card bg-panel border border-signal/20 px-4 py-3 hover:border-signal/40 transition-colors"
                  >
                    <p className="text-sm font-medium">
                      {bout.fighterA?.displayName ?? "TBD"} <span className="text-mute font-normal">vs</span>{" "}
                      {bout.fighterB?.displayName ?? "TBD"}
                    </p>
                    <p className="text-xs text-mute mt-0.5">
                      Bout {bout.number} · {bout.weightClass}
                      {winnerName ? ` · ${winnerName} won` : ""}
                      {bout.result?.method ? ` · ${bout.result.method}` : ""}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
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
  const scheduleBouts = dayBouts.filter((b) => b.status !== "DRAFT" && b.status !== "FINAL" && (!weight || b.weightClass === weight));
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

  const finalBouts = dayBouts.filter((b) => b.status === "FINAL");
  const resultBouts = finalBouts.filter((b) => !weight || b.weightClass === weight);
  const liveBoutId = liveNow?.id ?? null;
  const pill = eventStatusPillFor(
    event.status,
    isEventLive(ringProjections) ? "LIVE" : event.status === "INTERMISSION" ? "INTERMISSION" : null,
  );

  // Results are now a toggle inside the Card tab (see #card below), not a
  // separate anchor stop — one control for "what's happening" vs. "what's
  // already happened," instead of two overlapping ones.
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "live", label: "Live" },
    { id: "card", label: "Card" },
    { id: "info", label: "Info" },
  ];

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 pb-10">
      <div id="overview" className="scroll-mt-24">
        <div className="flex items-center justify-between mb-4">
          <BackButton fallbackHref="/events" />
          <Link href="/" aria-label="Go to PUGNA home" className="font-bold tracking-tight text-sm shrink-0">
            PUGNA<span className="text-signal">.</span>
          </Link>
        </div>

        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="w-full aspect-video object-cover rounded-card mb-4" />
        )}

        <div className="space-y-1.5 mb-4">
          {pill && (
            <div className="flex items-center gap-2">
              <Badge live={pill.live} tone={pill.live ? "live" : "neutral"}>
                {pill.text}
              </Badge>
              {event._count.follows > 0 && (
                <span className="text-[11px] text-mute tabular">
                  {new Intl.NumberFormat("en-US").format(event._count.follows)} watching
                </span>
              )}
            </div>
          )}
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

        <div className="flex items-center gap-2 mb-6">
          <FollowButton eventId={event.id} slug={slug} isGuest={!actor} following={following} />
          <ShareSheet code={event.code} name={event.name} />
          <Link href="/account" aria-label="Account" className="rounded-full border border-white/15 p-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
            </svg>
          </Link>
          {event.status === "CANCELLED" && event.cancelReason && (
            <p className="text-sm text-error">Cancelled: {event.cancelReason}</p>
          )}
        </div>

        <EventTabs tabs={tabs} />

        <DaySelector
          slug={slug}
          dayCount={event.dayCount}
          eventDate={event.date}
          selectedDay={selectedDay}
          boutCounts={boutCountsByDay}
          buildQuery={(changes) => buildQuery({ day, weight }, changes)}
        />
      </div>

      <div id="live" className="mt-6 space-y-4 scroll-mt-24">
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

        <LiveAudience
          slug={slug}
          checkedInCount={checkedInCount}
          viewerCheckedIn={Boolean(viewerCheckIn)}
          liveBoutId={liveBoutId}
        />
      </div>

      <div id="card" className="mt-8 space-y-3 scroll-mt-24">
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
          <ScheduleResultsToggle
            resultsCount={resultBouts.length}
            schedule={
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
            }
            results={
              <>
                <p className="text-xs font-semibold text-mute uppercase tracking-wide pt-2">Results</p>
                <ResultsList
                  slug={slug}
                  bouts={resultBouts}
                  weightClasses={weight ? [weight] : weightClasses}
                  rings={event.rings}
                />
              </>
            }
          />
        )}
      </div>

      <div id="info" className="mt-8 space-y-4 scroll-mt-24">
        <div className="rounded-card bg-panel border border-white/10 p-5 space-y-3">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Event Info</p>
          {(event.venue || event.city) && (
            <div>
              <p className="text-xs text-mute">Venue</p>
              <p className="text-sm font-medium">{venueLabel}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-mute">Date</p>
            <p className="text-sm font-medium">{formatDateRange(event.date, event.dayCount)}</p>
          </div>
          {event.startTime && (
            <div>
              <p className="text-xs text-mute">Start</p>
              <p className="text-sm font-medium">{formatTime(event.startTime)}</p>
            </div>
          )}
          {directionsHref && (
            <a
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-pill border border-white/20 text-ink text-sm font-medium px-4 py-2"
            >
              Directions
            </a>
          )}
        </div>

        {organizerName && (
          <div className="rounded-card bg-panel border border-white/10 p-5 space-y-2">
            <p className="text-xs font-semibold text-mute uppercase tracking-wide">Organized by</p>
            {organizerHref ? (
              <Link href={organizerHref} className="text-sm font-semibold text-signal">
                {organizerName} →
              </Link>
            ) : (
              <p className="text-sm font-semibold">{organizerName}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
