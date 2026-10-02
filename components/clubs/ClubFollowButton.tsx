"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleClubFollow } from "@/lib/actions/club";
import { Button } from "@/components/ui/Button";

export function ClubFollowButton({
  clubId,
  isGuest,
  following,
}: {
  clubId: string;
  isGuest: boolean;
  following: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (isGuest) {
    return (
      <Button
        onClick={() => router.push(`/account?returnTo=${encodeURIComponent(`/clubs/${clubId}`)}`)}
        variant="outline" size="sm" text="sm" weight="medium" className="px-4"
      >
        Follow
      </Button>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleClubFollow(clubId);
          router.refresh();
        })
      }
      className={[
        "rounded-pill text-sm font-medium px-4 py-2.5 border disabled:opacity-60",
        following ? "bg-success text-onsignal border-success" : "border-white/20 text-ink",
      ].join(" ")}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
