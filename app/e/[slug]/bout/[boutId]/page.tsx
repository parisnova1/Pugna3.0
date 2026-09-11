import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { deleteMedia } from "@/lib/actions/media";
import { MediaUploader } from "@/components/host/MediaUploader";
import { BackButton } from "@/components/event/ContextBar";
import { NotifyButton } from "@/components/event/NotifyButton";
import { Badge } from "@/components/ui/Badge";
import type { BoutStatus } from "@prisma/client";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  TBD: "Opponent TBD",
  CONFIRMED: "Confirmed",
  READY: "Scheduled",
  DELAYED: "Delayed",
  IN_PROGRESS: "Live",
  FINAL: "Final",
  SCRATCHED: "Scratched",
  NO_SHOW: "No-show",
};

// A fight is "upcoming" — worth notifying about — before it's live and before it's over.
const UPCOMING_STATUSES: BoutStatus[] = ["TBD", "CONFIRMED", "READY", "DELAYED"];

export default async function BoutDetailPage({
  params,
}: {
  params: Promise<{ slug: string; boutId: string }>;
}) {
  const { slug, boutId } = await params;

  const bout = await prisma.bout.findUnique({
    where: { id: boutId },
    include: { event: true, fighterA: { include: { club: true } }, fighterB: { include: { club: true } }, result: true },
  });

  if (!bout || bout.event.slug !== slug) notFound();

  const actor = await getActor();
  const published = bout.event.status !== "DRAFT" && bout.event.status !== "READY";
  const view = can(actor, "event.view", { eventId: bout.event.id, eventPublished: published });
  if (!view.allowed) notFound();

  const canEdit = can(actor, "event.edit", { eventId: bout.event.id }).allowed;
  const media = await prisma.media.findMany({
    where: { attachedType: "BOUT", attachedId: bout.id },
    orderBy: { createdAt: "desc" },
  });

  const isUpcoming = UPCOMING_STATUSES.includes(bout.status);
  const following = actor
    ? Boolean(await prisma.follow.findUnique({ where: { userId_eventId: { userId: actor.userId, eventId: bout.event.id } } }))
    : false;

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 pb-10 space-y-6">
      <div className="flex items-center justify-between">
        <BackButton />
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

      <div className="text-center space-y-1">
        <p className="text-xs text-mute">
          Bout {bout.number} · {bout.weightClass}
        </p>
        <p className="text-xs font-semibold text-signal uppercase tracking-wide">{STATUS_LABEL[bout.status]}</p>
      </div>

      <div className="rounded-card bg-panel border border-white/10 p-6 space-y-4">
        <FighterRow
          name={bout.fighterA?.displayName}
          club={bout.fighterA?.club?.name}
          isWinner={Boolean(bout.result && bout.fighterAId && bout.result.winnerId === bout.fighterAId)}
        />
        <div className="text-center text-mute text-sm">vs</div>
        <FighterRow
          name={bout.fighterB?.displayName}
          club={bout.fighterB?.club?.name}
          isWinner={Boolean(bout.result && bout.fighterBId && bout.result.winnerId === bout.fighterBId)}
        />
      </div>

      {bout.result && (
        <div className="rounded-card bg-panel border border-signal/30 p-4">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide mb-1">Result</p>
          <p className="text-sm font-semibold text-signal">
            {bout.result.winnerId
              ? `${bout.result.winnerId === bout.fighterAId ? bout.fighterA?.displayName : bout.fighterB?.displayName} won`
              : "Draw"}
          </p>
          <p className="text-sm text-mute mt-0.5">
            {bout.result.method}
            {bout.result.round ? ` · Round ${bout.result.round}` : ""}
          </p>
        </div>
      )}

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
    </div>
  );
}

function FighterRow({ name, club, isWinner }: { name?: string; club?: string | null; isWinner?: boolean }) {
  return (
    <div className={`text-center rounded-card py-1.5 ${isWinner ? "bg-signal/10 border border-signal/30" : ""}`}>
      <div className="flex items-center justify-center gap-1.5">
        <p className={`font-semibold ${isWinner ? "text-signal" : ""}`}>{name ?? "TBD"}</p>
        {isWinner && <Badge tone="signal">Winner</Badge>}
      </div>
      <p className="text-xs text-mute mt-0.5">{club ?? (name ? "Guest" : "—")}</p>
    </div>
  );
}
