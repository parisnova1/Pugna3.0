"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleFollow } from "@/lib/actions/follow";
import { Button } from "@/components/ui/Button";

export function FollowButton({
  eventId,
  slug,
  isGuest,
  following,
}: {
  eventId: string;
  slug: string;
  isGuest: boolean;
  following: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (isGuest) {
    return (
      <Button
        onClick={() => router.push(`/account?returnTo=${encodeURIComponent(`/e/${slug}`)}`)}
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
          await toggleFollow(eventId, slug);
        })
      }
      className={[
        "rounded-pill text-sm font-medium px-4 py-2 border",
        following ? "bg-success text-onsignal border-success" : "border-white/20 text-ink",
      ].join(" ")}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
