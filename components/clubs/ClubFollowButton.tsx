"use client";

import { toggleClubFollow } from "@/lib/actions/club";
import { FollowToggle } from "@/components/ui/FollowToggle";

export function ClubFollowButton({
  clubId,
  isGuest,
  following,
}: {
  clubId: string;
  isGuest: boolean;
  following: boolean;
}) {
  return (
    <FollowToggle
      isGuest={isGuest}
      following={following}
      returnTo={`/clubs/${clubId}`}
      toggle={() => toggleClubFollow(clubId)}
      size="sm"
    />
  );
}
