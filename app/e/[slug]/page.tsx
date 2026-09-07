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

export default async function EventCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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

  const bouts: BoutView[] = event.bouts.map((b) => ({
    id: b.id,
    number: b.number,
    weightClass: b.weightClass,
    status: b.status,
    delayMinutes: b.delayMinutes,
    fighterAName: b.fighterA?.displayName ?? null,
    fighterBName: b.fighterB?.displayName ?? null,
  }));

  const statusPill =
    event.status === "CANCELLED"
      ? "Cancelled"
      : event.status === "FINISHED"
        ? "Finished"
        : projection.nowLabel === "LIVE"
          ? "Live"
          : event.status === "PUBLISHED"
            ? "Upcoming"
            : projection.nowLabel === "INTERMISSION"
              ? "Intermission"
              : null;

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

      <div className="mb-6">
        {statusPill && (
          <span
            className={[
              "inline-block text-[11px] font-semibold tracking-wide rounded-pill px-2 py-0.5 mb-2",
              statusPill === "Live" ? "bg-signal text-onsignal" : "text-mute border border-white/10",
            ].join(" ")}
          >
            {statusPill}
          </span>
        )}
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-mute text-sm mt-1">
          {formatEventDate(event.date)}
          {event.startTime ? ` · ${formatTime(event.startTime)}` : ""} · {event.venue ?? event.city ?? "TBD"}
        </p>
        {event.streamUrl && event.status !== "CANCELLED" && (
          <a
            href={event.streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-signal mt-2 font-medium"
          >
            Watch stream ↗
          </a>
        )}
        {event.status === "CANCELLED" && event.cancelReason && (
          <p className="text-sm text-signal mt-2">Cancelled: {event.cancelReason}</p>
        )}
      </div>

      <LiveEventCard
        slug={slug}
        initialStatus={event.status}
        initialBouts={bouts}
        initialNowLabel={projection.nowLabel}
        initialNowId={projection.now?.id ?? null}
        initialNextId={projection.next?.id ?? null}
      />
    </div>
  );
}
