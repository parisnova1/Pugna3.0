import { requireHostEvent } from "@/lib/host-guard";
import { prisma } from "@/lib/prisma";
import { computeProjection } from "@/lib/projection";
import { formatEventDate, formatTime } from "@/lib/format";
import { BackButton } from "@/components/event/ContextBar";
import { LiveEventCard, type BoutView } from "@/components/event/LiveEventCard";

export default async function PreviewEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireHostEvent(id, `/host/events/${id}/preview`);

  const projection = computeProjection(event.status, event.bouts);

  const media = await prisma.media.findMany({
    where: { attachedType: "EVENT", attachedId: event.id },
    orderBy: { createdAt: "desc" },
  });
  const coverUrl = media.find((m) => m.kind === "EVENT_COVER")?.url ?? null;
  const galleryUrls = media.filter((m) => m.kind === "EVENT_GALLERY").map((m) => m.url);
  const sponsorUrls = media.filter((m) => m.kind === "SPONSOR").map((m) => m.url);

  const bouts: BoutView[] = event.bouts.map((b) => ({
    id: b.id,
    number: b.number,
    weightClass: b.weightClass,
    status: b.status,
    delayMinutes: b.delayMinutes,
    fighterAName: b.fighterA?.displayName ?? null,
    fighterBName: b.fighterB?.displayName ?? null,
  }));

  const dateLabel = `${formatEventDate(event.date)}${event.startTime ? ` · ${formatTime(event.startTime)}` : ""}`;
  const venueLabel = event.venue ?? event.city ?? "TBD";

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 pb-10 space-y-4">
      <div className="flex items-center justify-between">
        <BackButton />
        <span className="text-[11px] font-semibold text-mute border border-white/10 rounded-pill px-2 py-0.5">
          Preview · not published
        </span>
      </div>
      <LiveEventCard
        slug=""
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
        initialFollowerCount={0}
        coverUrl={coverUrl}
        galleryUrls={galleryUrls}
        sponsorUrls={sponsorUrls}
      />
    </div>
  );
}
