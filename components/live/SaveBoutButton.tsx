"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleSavedBout } from "@/lib/actions/savedBout";

export function SaveBoutButton({
  boutId,
  returnTo,
  isGuest,
  saved,
}: {
  boutId: string;
  returnTo: string;
  isGuest: boolean;
  saved: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (isGuest) {
    return (
      <button
        onClick={() => router.push(`/account?returnTo=${encodeURIComponent(returnTo)}`)}
        aria-label="Save this fight"
        className="rounded-full border border-white/15 p-2.5"
      >
        ♡
      </button>
    );
  }

  return (
    <button
      disabled={pending}
      aria-label={saved ? "Remove from saved fights" : "Save this fight"}
      onClick={() =>
        startTransition(async () => {
          await toggleSavedBout(boutId);
          router.refresh();
        })
      }
      className={[
        "rounded-full p-2.5 border disabled:opacity-60",
        saved ? "bg-signal text-onsignal border-signal" : "border-white/15",
      ].join(" ")}
    >
      {saved ? "♥" : "♡"}
    </button>
  );
}
