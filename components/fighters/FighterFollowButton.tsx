"use client";

import { toggleFighterFollow } from "@/lib/actions/fighterFollow";
import { FollowToggle } from "@/components/ui/FollowToggle";

export function FighterFollowButton({
  fighterId,
  isGuest,
  following,
}: {
  fighterId: string;
  isGuest: boolean;
  following: boolean;
}) {
  return (
    <FollowToggle
      isGuest={isGuest}
      following={following}
      returnTo={`/fighters/${fighterId}`}
      toggle={() => toggleFighterFollow(fighterId)}
    />
  );
}
