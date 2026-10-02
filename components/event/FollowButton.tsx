"use client";

import { toggleFollow } from "@/lib/actions/follow";
import { FollowToggle } from "@/components/ui/FollowToggle";

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
  return (
    <FollowToggle
      isGuest={isGuest}
      following={following}
      returnTo={`/e/${slug}`}
      toggle={() => toggleFollow(eventId, slug)}
      refresh={false}
    />
  );
}
