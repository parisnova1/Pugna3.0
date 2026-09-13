import { requireHostEvent } from "@/lib/host-guard";
import { LiveConsole, type ConsoleBout, type ConsoleRing } from "@/components/live/LiveConsole";

export default async function LiveConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, event } = await requireHostEvent(id, `/host/events/${id}/live`, { minimum: "member" });

  // requireHostEvent (minimum: "member") already guarantees a membership row exists.
  const membership = actor!.hostRoles[event.id]!;
  const isRingOfficial = membership.role === "RING_OFFICIAL";
  const isStaff = membership.role === "EVENT_STAFF";
  const canManageEvent = membership.role === "EVENT_OWNER" || membership.role === "EVENT_ADMIN";

  const visibleRingIds = isRingOfficial ? new Set(membership.ringIds) : null;
  const visibleEventRings = visibleRingIds ? event.rings.filter((r) => visibleRingIds.has(r.id)) : event.rings;
  const visibleEventBouts = visibleRingIds ? event.bouts.filter((b) => visibleRingIds.has(b.ringId)) : event.bouts;

  const bouts: ConsoleBout[] = visibleEventBouts.map((b) => ({
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
    winnerId: b.result?.winnerId ?? null,
    ringId: b.ringId,
    totalRounds: b.totalRounds,
    roundDurationSec: b.roundDurationSec,
    restDurationSec: b.restDurationSec,
    currentRound: b.currentRound,
    roundPhase: b.roundPhase,
    phaseEndsAt: b.phaseEndsAt,
    streamUrl: b.streamUrl,
  }));

  const rings: ConsoleRing[] = visibleEventRings.map((r) => ({
    id: r.id,
    number: r.number,
    name: r.name,
    onBreak: r.onBreak,
    breakUntil: r.breakUntil,
  }));

  return (
    <div className="pt-2">
      <LiveConsole
        eventId={event.id}
        eventStatus={event.status}
        intermissionUntil={event.intermissionUntil}
        rings={rings}
        bouts={bouts}
        slug={event.slug}
        canAct={!isStaff}
        canManageEvent={canManageEvent}
      />
    </div>
  );
}
