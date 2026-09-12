"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleFighterFollow } from "@/lib/actions/fighterFollow";

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
      <button
        onClick={() => router.push(`/account?returnTo=${encodeURIComponent(`/fighters/${fighterId}`)}`)}
        className="rounded-pill border border-white/20 text-ink text-sm font-medium px-4 py-2"
      >
        Follow
      </button>
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
