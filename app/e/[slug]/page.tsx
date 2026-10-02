import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventCardData } from "@/lib/event-query";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { computeRingProjections, isEventLive } from "@/lib/projection";
import { formatEventDate, formatTime, formatDateRange, currentDayNumber } from "@/lib/format";
import { BackButton } from "@/components/event/ContextBar";
import { LiveEventCard, type BoutView } from "@/components/event/LiveEventCard";
import { eventStatusPillFor } from "@/lib/bout-status";
import { BracketDiagram, isValidBracket, roundLabelForSize, type BracketRound } from "@/components/event/BracketDiagram";
import { DaySelector } from "@/components/event/overview/DaySelector";
import { WeightClassChips } from "@/components/event/overview/WeightClassChips";
import { RingSection } from "@/components/event/overview/RingSection";
import { LiveRingFilter } from "@/components/event/overview/LiveRingFilter";
import { ScheduleList } from "@/components/event/overview/ScheduleList";
import { ResultsList } from "@/components/event/overview/ResultsList";
import { ScheduleResultsToggle } from "@/components/event/overview/ScheduleResultsToggle";
import { EventStickyNav } from "@/components/event/EventStickyNav";
import type { EventTab } from "@/components/event/EventTabs";
import { LiveAudience } from "@/components/event/LiveAudience";
import { ParticipatingClubs } from "@/components/event/ParticipatingClubs";
import { LiveDot } from "@/components/ui/LiveDot";
import { JsonLd } from "@/components/seo/JsonLd";
import { EventHeader, EventInfoCard, OrganizerCard } from "@/components/event/overview/EventBlocks";
import { getEventMeta } from "@/lib/seo-queries";
import { absoluteUrl, buildMetadata, privateMetadata, sportsEventJsonLd } from "@/lib/seo";
import { isPublishedEventStatus } from "@/lib/event-status";

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventMeta(slug);
  // Unknown or unpublished events get a generic, non-indexed title so a draft's
  // name and date can never reach a search snippet or link preview.
  if (!event || !isPublishedEventStatus(event.status)) return privateMetadata("Event");

  const where = event.venue ?? event.city;
  const when = formatDateRange(event.date, event.dayCount);
  return buildMetadata({
    title: `${event.name} — ${when}`,
    description:
      event.description ??
      `${event.sport} event${where ? ` at ${where}` : ""} on ${when}. Live results, fight card and schedule on PUGNA.`,
    path: `/e/${event.slug}`,
    image: event.coverUrl,
  });
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
  const published = isPublishedEventStatus(event.status);

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

  const eventJsonLd = published
    ? sportsEventJsonLd({
        slug,
        name: event.name,
        description: event.description,
        sport: event.sport,
        status: event.status,
        date: event.date,
        startTime: event.startTime,
        dayCount: event.dayCount,
        venue: event.venue,
        city: event.city,
        latitude: event.latitude,
        longitude: event.longitude,
        image: coverUrl,
        organizerName,
        organizerUrl: organizerHref ? absoluteUrl(organizerHref) : null,
        organizerType: event.organizingClub ? "Organization" : "Person",
      })
    : null;

  const [participations, nominations] = await Promise.all([
    prisma.clubEventParticipation.findMany({ where: { eventId: event.id }, include: { club: true } }),
    prisma.nomination.findMany({ where: { eventId: event.id }, select: { clubId: true } }),
  ]);
  const nominationCountByClub = new Map<string, number>();
  for (const nom of nominations) {
    nominationCountByClub.set(nom.clubId, (nominationCountByClub.get(nom.clubId) ?? 0) + 1);
  }
  const participatingClubs = participations.map((p) => ({
    clubId: p.clubId,
    clubName: p.club.name,
    nominatedCount: nominationCountByClub.get(p.clubId) ?? 0,
  }));

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
    const isLive = projection.nowLabel === "LIVE";

    const tabs: EventTab[] = [
      { id: "overview", label: "Overview" },
      {
        id: "live",
        label: isLive ? (
          <span className="inline-flex items-center gap-1.5">
            <LiveDot /> Live
          </span>
        ) : (
          "Live"
        ),
        emphasize: isLive,
      },
      { id: "card", label: "Card" },
      ...(finalBouts.length > 0 ? [{ id: "results", label: "Results" }] : []),
      { id: "info", label: "Info" },
    ];

    return (
      <div className="mx-auto w-full max-w-md lg:max-w-5xl px-4 pt-4 pb-10">
        {eventJsonLd && <JsonLd data={eventJsonLd} />}
        <EventHeader
          coverUrl={coverUrl}
          pill={pill}
          followCount={event._count.follows}
          name={event.name}
          venueLabel={venueLabel}
          dateText={dateLabel}
          eventId={event.id}
          slug={slug}
          code={event.code}
          isGuest={!actor}
          following={following}
          cancelReason={event.status === "CANCELLED" ? event.cancelReason : null}
        />

        {/* Sibling of #overview, not a child of it — its sticky containing block needs to span the
            whole page (this outer div), not just the hero, or it would stop sticking as soon as
            #overview's own (short) box scrolled past. */}
        <EventStickyNav eventName={event.name} isLive={isLive} fallbackHref="/events" tabs={tabs} />

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
              <EventInfoCard
                hasVenue={Boolean(event.venue || event.city)}
                venueLabel={venueLabel}
                dateText={formatEventDate(event.date)}
                startTime={event.startTime}
                directionsHref={directionsHref}
              />

              {organizerName && <OrganizerCard name={organizerName} href={organizerHref} />}

              <ParticipatingClubs clubs={participatingClubs} />
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
  const isLive = isEventLive(ringProjections);
  const pill = eventStatusPillFor(event.status, isLive ? "LIVE" : event.status === "INTERMISSION" ? "INTERMISSION" : null);

  // Results are now a toggle inside the Card tab (see #card below), not a
  // separate anchor stop — one control for "what's happening" vs. "what's
  // already happened," instead of two overlapping ones.
  const tabs: EventTab[] = [
    { id: "overview", label: "Overview" },
    {
      id: "live",
      label: isLive ? (
        <span className="inline-flex items-center gap-1.5">
          <LiveDot /> Live
        </span>
      ) : (
        "Live"
      ),
      emphasize: isLive,
    },
    { id: "card", label: "Card" },
    { id: "info", label: "Info" },
  ];

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 pb-10">
      {eventJsonLd && <JsonLd data={eventJsonLd} />}
      <EventHeader
        coverUrl={coverUrl}
        pill={pill}
        followCount={event._count.follows}
        name={event.name}
        venueLabel={venueLabel}
        dateText={formatDateRange(event.date, event.dayCount)}
        showPin
        eventId={event.id}
        slug={slug}
        code={event.code}
        isGuest={!actor}
        following={following}
        cancelReason={event.status === "CANCELLED" ? event.cancelReason : null}
      />

      {/* Sibling of #overview, not a child of it — see isSimple branch above for why. */}
      <EventStickyNav eventName={event.name} isLive={isLive} fallbackHref="/events" tabs={tabs} />

      <div className="mt-4">
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
        {event.rings.length > 1 ? (
          <LiveRingFilter
            sections={event.rings.map((ring) => ({
              id: ring.id,
              label: ring.name ?? `Ring ${ring.number}`,
              node: (
                <RingSection
                  key={ring.id}
                  slug={slug}
                  ring={ring}
                  projection={ringProjections.get(ring.id) ?? { now: null, next: null, nowLabel: null }}
                  stickyLabel={ring.id === liveRing?.id ? stickyLabel : null}
                  eventStreamUrl={event.streamUrl}
                />
              ),
            }))}
          />
        ) : (
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
        )}

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
        <EventInfoCard
          hasVenue={Boolean(event.venue || event.city)}
          venueLabel={venueLabel}
          dateText={formatDateRange(event.date, event.dayCount)}
          startTime={event.startTime}
          directionsHref={directionsHref}
        />

        {organizerName && <OrganizerCard name={organizerName} href={organizerHref} />}

        <ParticipatingClubs clubs={participatingClubs} />
      </div>
    </div>
  );
}
