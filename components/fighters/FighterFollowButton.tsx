"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleFighterFollow } from "@/lib/actions/fighterFollow";
import { Button } from "@/components/ui/Button";

export function FighterFollowButton({
  fighterId,
  isGuest,
  following,
}: {
  fighterId: string;
  isGuest: boolean;
  following: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (isGuest) {
    return (
      <Button
        onClick={() => router.push(`/account?returnTo=${encodeURIComponent(`/fighters/${fighterId}`)}`)}
        variant="outline" size="xs" text="sm" weight="medium" className="px-4"
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
          await toggleFighterFollow(fighterId);
          router.refresh();
        })
      }
      className={[
        "rounded-pill text-sm font-medium px-4 py-2 border disabled:opacity-60",
        following ? "bg-success text-onsignal border-success" : "border-white/20 text-ink",
      ].join(" ")}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
