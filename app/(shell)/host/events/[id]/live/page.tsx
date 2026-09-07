import { requireHostEvent } from "@/lib/host-guard";
import { LiveConsole, type ConsoleBout } from "@/components/live/LiveConsole";

export default async function LiveConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireHostEvent(id, `/host/events/${id}/live`);

  const bouts: ConsoleBout[] = event.bouts.map((b) => ({
    id: b.id,
    number: b.number,
    weightClass: b.weightClass,
    status: b.status,
    delayMinutes: b.delayMinutes,
    scratchReason: b.scratchReason,
    fighterAId: b.fighterAId,
    fighterBId: b.fighterBId,
    fighterAName: b.fighterA?.displayName ?? null,
    fighterBName: b.fighterB?.displayName ?? null,
  }));

  return (
    <div className="pt-2">
      <LiveConsole eventId={event.id} eventStatus={event.status} bouts={bouts} />
    </div>
  );
}
