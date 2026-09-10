import { requireHostEvent } from "@/lib/host-guard";
import { prisma } from "@/lib/prisma";
import { setCheckInStatus, notifyCheckInOpen } from "@/lib/actions/checkin";
import { QrCodeSheet } from "@/components/event/QrCodeSheet";
import { BackButton } from "@/components/event/ContextBar";

export default async function EventCheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireHostEvent(id, `/host/events/${id}/checkin`);

  const fighterMap = new Map<string, { id: string; displayName: string; weightClass: string | null }>();
  for (const bout of event.bouts) {
    if (bout.fighterA) fighterMap.set(bout.fighterA.id, bout.fighterA);
    if (bout.fighterB) fighterMap.set(bout.fighterB.id, bout.fighterB);
  }
  const fighters = [...fighterMap.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));

  const checkIns = await prisma.checkIn.findMany({ where: { attachedType: "EVENT", attachedId: event.id } });
  const checkInFor = (fighterId: string) => checkIns.find((c) => c.fighterId === fighterId) ?? null;

  const checkedInCount = checkIns.filter((c) => c.status === "CHECKED_IN").length;

  return (
    <div className="space-y-6 pt-2">
      <BackButton />
      <div>
        <h1 className="text-2xl font-semibold">Check-in</h1>
        <p className="text-mute text-sm mt-1">
          {checkedInCount} of {fighters.length} checked in
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <QrCodeSheet path={`/checkin/event/${event.id}`} label="Check-in QR" buttonLabel="Show check-in QR" />
        <form
          action={async () => {
            "use server";
            await notifyCheckInOpen("EVENT", event.id);
          }}
        >
          <button type="submit" className="w-full rounded-pill border border-white/20 text-ink font-semibold py-3 text-sm">
            Notify fighters
          </button>
        </form>
      </div>

      <div className="space-y-2">
        {fighters.length === 0 ? (
          <p className="text-sm text-mute">No boxers on the card yet.</p>
        ) : (
          fighters.map((f) => {
            const checkIn = checkInFor(f.id);
            return (
              <div key={f.id} className="rounded-card bg-panel border border-white/10 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{f.displayName}</p>
                  <p className="text-xs text-mute mt-0.5">
                    {f.weightClass ?? "—"} ·{" "}
                    {checkIn?.status === "CHECKED_IN" ? "🟢 Checked in" : checkIn?.status === "NO_SHOW" ? "No-show" : "Not checked in"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <form
                    action={async () => {
                      "use server";
                      await setCheckInStatus("EVENT", event.id, f.id, "CHECKED_IN");
                    }}
                  >
                    <button type="submit" className="rounded-pill border border-white/20 px-3 py-1.5 text-[11px] font-medium">
                      Check in
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await setCheckInStatus("EVENT", event.id, f.id, "NO_SHOW");
                    }}
                  >
                    <button type="submit" className="rounded-pill border border-white/20 px-3 py-1.5 text-[11px] font-medium">
                      No-show
                    </button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
