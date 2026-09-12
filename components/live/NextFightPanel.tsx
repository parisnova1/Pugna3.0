import Link from "next/link";
import { NotifyNextFightButton } from "@/components/live/NotifyNextFightButton";

export function NextFightPanel({
  fighterId,
  fighterName,
  eventId,
  slug,
  isGuest,
  alertOn,
  autoAlertFighterId,
  nextBout,
}: {
  fighterId: string;
  fighterName: string;
  eventId: string;
  slug: string;
  isGuest: boolean;
  alertOn: boolean;
  autoAlertFighterId?: string;
  nextBout: { id: string; opponentName: string; weightClass: string; number: number; ringName: string } | null;
}) {
  return (
    <div className="rounded-card bg-panel border border-white/10 p-4 space-y-3">
      <p className="text-xs font-semibold text-mute uppercase tracking-wide">Next fight</p>

      {nextBout ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {fighterName} <span className="text-mute font-normal">vs</span> {nextBout.opponentName}
          </p>
          <p className="text-xs text-mute">
            Bout {nextBout.number} · {nextBout.weightClass} · {nextBout.ringName}
          </p>
        </div>
      ) : (
        <p className="text-sm text-mute">{fighterName}&apos;s next opponent hasn&apos;t been determined yet.</p>
      )}

      <NotifyNextFightButton
        fighterId={fighterId}
        eventId={eventId}
        slug={slug}
        fighterName={fighterName}
        isGuest={isGuest}
        alertOn={alertOn}
        autoAlertFighterId={autoAlertFighterId}
      />

      {nextBout && (
        <Link href={`/e/${slug}/bout/${nextBout.id}`} className="block text-center text-sm font-semibold text-signal">
          View Fight →
        </Link>
      )}
    </div>
  );
}
