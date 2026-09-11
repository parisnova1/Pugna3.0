"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { joinClub } from "@/lib/actions/club";
import { becomeBoxer } from "@/lib/actions/profile";

export function JoinClubButton({
  clubId,
  isGuest,
  hasFighterProfile,
  isMember,
  inAnotherClub,
}: {
  clubId: string;
  isGuest: boolean;
  hasFighterProfile: boolean;
  isMember: boolean;
  inAnotherClub: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (isGuest) {
    return (
      <button
        onClick={() => router.push(`/account?returnTo=${encodeURIComponent(`/clubs/${clubId}`)}`)}
        className="rounded-pill bg-signal text-onsignal text-sm font-semibold px-4 py-2.5"
      >
        Join Club
      </button>
    );
  }

  if (isMember) {
    return (
      <span className="rounded-pill border border-white/15 text-mute text-sm font-medium px-4 py-2.5">
        Member
      </span>
    );
  }

  if (inAnotherClub) {
    return (
      <span
        title="You're already with a club"
        className="rounded-pill border border-white/15 text-mute text-sm font-medium px-4 py-2.5"
      >
        Already with a club
      </span>
    );
  }

  if (!hasFighterProfile) {
    return (
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await becomeBoxer();
            router.refresh();
          })
        }
        className="rounded-pill border border-white/20 text-ink text-sm font-semibold px-4 py-2.5 disabled:opacity-60"
      >
        Register to join
      </button>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await joinClub(clubId);
          router.refresh();
        })
      }
      className="rounded-pill bg-signal text-onsignal text-sm font-semibold px-4 py-2.5 disabled:opacity-60"
    >
      Join Club
    </button>
  );
}
