"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";

/**
 * The Follow / Following button shared by events, clubs and fighters. Guests
 * are sent to sign in and brought back to `returnTo`; signed-in users toggle
 * through `toggle`. Each caller supplies only what differs.
 */
export function FollowToggle({
  isGuest,
  following,
  returnTo,
  toggle,
  size = "xs",
  refresh = true,
}: {
  isGuest: boolean;
  following: boolean;
  returnTo: string;
  toggle: () => Promise<unknown>;
  size?: "xs" | "sm";
  /** Re-render the page after toggling; not needed when the action already revalidates it. */
  refresh?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (isGuest) {
    return (
      <Button
        onClick={() => router.push(`/account?returnTo=${encodeURIComponent(returnTo)}`)}
        variant="outline"
        size={size}
        text="sm"
        weight="medium"
        className="px-4"
      >
        Follow
      </Button>
    );
  }

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggle();
          if (refresh) router.refresh();
        })
      }
      variant={following ? "success" : "outline"}
      size={size}
      text="sm"
      weight="medium"
      className="px-4"
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
