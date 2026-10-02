"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { joinClub } from "@/lib/actions/club";
import { becomeBoxer } from "@/lib/actions/profile";
import { Button } from "@/components/ui/Button";

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
      <Button
        onClick={() => router.push(`/account?returnTo=${encodeURIComponent(`/clubs/${clubId}`)}`)}
        size="sm" text="sm" className="px-4"
      >
        Join Club
      </Button>
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
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await becomeBoxer();
            router.refresh();
          })
        }
        variant="outline" size="sm" text="sm" className="px-4"
      >
        Register to join
      </Button>
    );
  }

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await joinClub(clubId);
          router.refresh();
        })
      }
      size="sm" text="sm" className="px-4"
    >
      Join Club
    </Button>
  );
}
