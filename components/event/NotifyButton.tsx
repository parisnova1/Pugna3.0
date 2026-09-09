"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleFollow } from "@/lib/actions/follow";
import { ClockIcon } from "@/components/nav/icons";

export function NotifyButton({
  eventId,
  slug,
  returnTo,
  isGuest,
  following,
}: {
  eventId: string;
  slug: string;
  returnTo: string;
  isGuest: boolean;
  following: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (isGuest) {
    return (
      <button
        onClick={() => router.push(`/account?returnTo=${encodeURIComponent(returnTo)}`)}
        aria-label="Notify me when this fight starts"
        className="rounded-full border border-white/15 p-2.5"
      >
        <ClockIcon className="shrink-0" />
      </button>
    );
  }

  return (
    <button
      disabled={pending}
      aria-label={following ? "Notifications on for this fight" : "Notify me when this fight starts"}
      onClick={() =>
        startTransition(async () => {
          await toggleFollow(eventId, slug);
        })
      }
      className={[
        "rounded-full p-2.5 border disabled:opacity-60",
        following ? "bg-signal text-onsignal border-signal" : "border-white/15",
      ].join(" ")}
    >
      <ClockIcon className="shrink-0" />
    </button>
  );
}
