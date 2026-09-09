import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventCardData } from "@/lib/event-query";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { computeRingProjections } from "@/lib/projection";
import { formatEventDate, formatTime, currentDayNumber } from "@/lib/format";
import { BackButton } from "@/components/event/ContextBar";
import { FollowButton } from "@/components/event/FollowButton";
import { ShareSheet } from "@/components/event/ShareSheet";
import { LiveEventCard, type BoutView } from "@/components/event/LiveEventCard";

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
      fighterAName: b.fighterA?.displayName ?? null,
      fighterBName: b.fighterB?.displayName ?? null,
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

  const weightClasses = [...new Set(event.bouts.map((b) => b.weightClass))].sort((a, b) => weightKg(a) - weightKg(b));
  const bracketBouts = [...event.bouts]
    .filter((b) => b.status !== "DRAFT" && (!weight || b.weightClass === weight))
    .sort((a, b) => a.day - b.day || a.number - b.number);

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 pb-10">
      {header}
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="w-full aspect-video object-cover rounded-card mb-5" />
      )}
      <div className="space-y-1 mb-5">
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-mute text-sm">
          {dateLabel} · {venueLabel}
        </p>
      </div>

      {event.dayCount > 1 && (
        <div className="flex gap-2 overflow-x-auto mb-5">
          {Array.from({ length: event.dayCount }, (_, i) => i + 1).map((d) => (
            <Link
              key={d}
              href={`/e/${slug}${buildQuery({ day, weight }, { day: String(d) })}`}
              className={[
                "rounded-pill border px-4 py-2 text-sm font-medium whitespace-nowrap",
                d === selectedDay ? "border-signal bg-signal/10" : "border-white/15 text-mute",
              ].join(" ")}
            >
              Day {d}
            </Link>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {event.rings.map((ring) => {
          const ringProjection = ringProjections.get(ring.id) ?? { now: null, next: null, nowLabel: null };
          const now = dayBouts.find((b) => b.id === ringProjection.now?.id) ?? null;
          const pillText =
            ringProjection.nowLabel === "LIVE"
              ? "Live"
              : ringProjection.nowLabel === "DELAYED"
                ? "Delayed"
                : ringProjection.nowLabel === "BREAK"
                  ? "On break"
                  : ringProjection.nowLabel === "UP_NEXT"
                    ? "Up next"
                    : "No bout";

          return (
            <Link
              key={ring.id}
              href={`/e/${slug}/ring/${ring.id}`}
              className="block rounded-card bg-panel border border-white/10 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{ring.name ?? `Ring ${ring.number}`}</p>
                <span
                  className={[
                    "text-[11px] font-semibold tracking-wide rounded-pill px-2 py-0.5",
                    ringProjection.nowLabel === "LIVE" ? "bg-signal text-onsignal" : "text-mute border border-white/10",
                  ].join(" ")}
                >
                  {pillText}
                </span>
              </div>
              {now ? (
                <p className="text-sm mt-2">
                  {now.fighterA?.displayName ?? "TBD"} <span className="text-mute">vs</span> {now.fighterB?.displayName ?? "TBD"}
                </p>
              ) : (
                <p className="text-sm text-mute mt-2">No bout in progress.</p>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-8 space-y-3">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Weight classes</p>
        <div className="flex gap-2 overflow-x-auto">
          <Link
            href={`/e/${slug}${buildQuery({ day, weight }, { weight: undefined })}`}
            className={[
              "rounded-pill border px-4 py-2 text-sm font-medium whitespace-nowrap",
              !weight ? "border-signal bg-signal/10" : "border-white/15 text-mute",
            ].join(" ")}
          >
            All
          </Link>
          {weightClasses.map((w) => (
            <Link
              key={w}
              href={`/e/${slug}${buildQuery({ day, weight }, { weight: w })}`}
              className={[
                "rounded-pill border px-4 py-2 text-sm font-medium whitespace-nowrap",
                w === weight ? "border-signal bg-signal/10" : "border-white/15 text-mute",
              ].join(" ")}
            >
              {w}
            </Link>
          ))}
        </div>

        <div className="space-y-2">
          {bracketBouts.map((bout) => {
            const ringLabel = event.rings.find((r) => r.id === bout.ringId);
            const isLive = bout.status === "IN_PROGRESS";
            const isFinal = bout.status === "FINAL";
            return (
              <Link
                key={bout.id}
                href={`/e/${slug}/bout/${bout.id}`}
                className={[
                  "block rounded-card border px-4 py-3",
                  isLive ? "border-signal/40 bg-signal/5" : "border-white/10 bg-panel",
                ].join(" ")}
              >
                <div className="flex items-center justify-between text-[11px] text-mute">
                  <span>
                    Day {bout.day} · {ringLabel?.name ?? "Ring"} · {bout.weightClass}
                    {bout.scheduledTime ? ` · ${formatTime(bout.scheduledTime)}` : ""}
                  </span>
                  <span className={isLive ? "text-signal font-semibold" : ""}>
                    {isLive ? "Live" : isFinal ? "Final" : bout.status === "SCRATCHED" ? "Scratched" : bout.status === "NO_SHOW" ? "No-show" : "Scheduled"}
                  </span>
                </div>
                <p className="text-sm font-medium mt-1">
                  {bout.fighterA?.displayName ?? "TBD"} <span className="text-mute font-normal">vs</span>{" "}
                  {bout.fighterB?.displayName ?? "TBD"}
                </p>
                {isFinal && bout.result && (
                  <p className="text-xs text-mute mt-0.5">
                    {bout.result.method}
                    {bout.result.round ? ` · Round ${bout.result.round}` : ""}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
