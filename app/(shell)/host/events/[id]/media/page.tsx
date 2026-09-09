import { requireHostEvent } from "@/lib/host-guard";
import { prisma } from "@/lib/prisma";
import { deleteMedia } from "@/lib/actions/media";
import { MediaUploader } from "@/components/host/MediaUploader";
import { BackButton } from "@/components/event/ContextBar";

export default async function MediaStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireHostEvent(id, `/host/events/${id}/media`);

  const media = await prisma.media.findMany({
    where: { attachedType: "EVENT", attachedId: event.id },
    orderBy: { createdAt: "desc" },
  });

  const cover = media.find((m) => m.kind === "EVENT_COVER") ?? null;
  const gallery = media.filter((m) => m.kind === "EVENT_GALLERY");
  const sponsors = media.filter((m) => m.kind === "SPONSOR");

  return (
    <div className="space-y-8 pt-2">
      <BackButton />
      <div>
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Step 6</p>
        <h1 className="text-2xl font-semibold">Media</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Cover</h2>
        {cover && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover.url} alt="" className="w-full aspect-video object-cover rounded-card" />
            <DeleteButton mediaId={cover.id} />
          </div>
        )}
        <MediaUploader kind="EVENT_COVER" attachedType="EVENT" attachedId={event.id} label={cover ? "Replace cover" : "Add cover"} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Gallery</h2>
        {gallery.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {gallery.map((m) => (
              <div key={m.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="w-full aspect-square object-cover rounded-card" />
                <DeleteButton mediaId={m.id} small />
              </div>
            ))}
          </div>
        )}
        <MediaUploader kind="EVENT_GALLERY" attachedType="EVENT" attachedId={event.id} label="Add photo" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Sponsors</h2>
        {sponsors.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {sponsors.map((m) => (
              <div key={m.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="h-14 w-auto object-contain rounded-card bg-panel p-2" />
                <DeleteButton mediaId={m.id} small />
              </div>
            ))}
          </div>
        )}
        <MediaUploader kind="SPONSOR" attachedType="EVENT" attachedId={event.id} label="Add sponsor graphic" />
      </section>
    </div>
  );
}

function DeleteButton({ mediaId, small }: { mediaId: string; small?: boolean }) {
  return (
    <form
      action={async () => {
        "use server";
        await deleteMedia(mediaId);
      }}
      className="absolute top-1 right-1"
    >
      <button
        type="submit"
        aria-label="Delete"
        className={[
          "flex items-center justify-center rounded-full bg-black/70 text-ink",
          small ? "w-5 h-5 text-xs" : "w-7 h-7 text-sm",
        ].join(" ")}
      >
        ×
      </button>
    </form>
  );
}
