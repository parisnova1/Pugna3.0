import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { BackButton } from "@/components/event/ContextBar";

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

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 pb-10 space-y-6">
      <BackButton />

      <div className="text-center space-y-1">
        <p className="text-xs text-mute">
          Bout {bout.number} · {bout.weightClass}
        </p>
        <p className="text-xs font-semibold text-signal uppercase tracking-wide">{STATUS_LABEL[bout.status]}</p>
      </div>

      <div className="rounded-card bg-panel border border-white/10 p-6 space-y-4">
        <FighterRow name={bout.fighterA?.displayName} club={bout.fighterA?.club?.name} />
        <div className="text-center text-mute text-sm">vs</div>
        <FighterRow name={bout.fighterB?.displayName} club={bout.fighterB?.club?.name} />
      </div>

      {bout.result && (
        <div className="rounded-card bg-panel border border-white/10 p-4">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide mb-1">Result</p>
          <p className="text-sm">
            {bout.result.method}
            {bout.result.round ? ` · Round ${bout.result.round}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function FighterRow({ name, club }: { name?: string; club?: string | null }) {
  return (
    <div className="text-center">
      <p className="font-semibold">{name ?? "TBD"}</p>
      <p className="text-xs text-mute mt-0.5">{club ?? (name ? "Guest" : "—")}</p>
    </div>
  );
}
