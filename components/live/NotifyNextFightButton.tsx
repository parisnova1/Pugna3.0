"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toggleFighterNextBoutAlert } from "@/lib/actions/fighterNextBoutAlert";

/**
 * "Notify me when this fighter fights next" — a standing subscription,
 * separate from following the fighter (components/fighters/FighterFollowButton.tsx).
 * Mirrors that button's guest/signed-in shape, plus one addition: if the
 * guest tap led to sign-in, the intended action is replayed automatically
 * once back on this page (via the `autoAlertFighterId` prop the server page
 * reads from `?autoAlert=`), instead of silently requiring a second tap.
 */
export function NotifyNextFightButton({
  fighterId,
  eventId,
  slug,
  fighterName,
  isGuest,
  alertOn,
  autoAlertFighterId,
}: {
  fighterId: string;
  eventId: string;
  slug: string;
  fighterName: string;
  isGuest: boolean;
  alertOn: boolean;
  autoAlertFighterId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const firedRef = useRef(false);

  const returnTo = `${pathname}?autoAlert=${encodeURIComponent(fighterId)}`;

  useEffect(() => {
    if (isGuest || firedRef.current || autoAlertFighterId !== fighterId) return;
    firedRef.current = true;
    if (alertOn) {
      router.replace(pathname);
      return;
    }
    startTransition(async () => {
      await toggleFighterNextBoutAlert(fighterId, eventId, slug);
      router.replace(pathname);
      router.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAlertFighterId, fighterId, isGuest]);

  if (isGuest) {
    return (
      <button
        onClick={() => router.push(`/account?returnTo=${encodeURIComponent(returnTo)}`)}
        className="w-full text-center rounded-pill border border-white/20 text-ink text-sm font-semibold px-4 py-3"
      >
        🔔 Notify me when {fighterName} fights next
      </button>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleFighterNextBoutAlert(fighterId, eventId, slug);
          router.refresh();
        })
      }
      className={[
        "w-full text-center rounded-pill text-sm font-semibold px-4 py-3 border disabled:opacity-60",
        alertOn ? "bg-signal text-onsignal border-signal" : "border-white/20 text-ink",
      ].join(" ")}
    >
      {alertOn ? `✓ You'll be notified when ${fighterName} fights next` : `🔔 Notify me when ${fighterName} fights next`}
    </button>
  );
}
