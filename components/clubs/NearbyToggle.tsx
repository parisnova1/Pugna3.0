"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** One-tap "Nearby" filter chip — a single browser geolocation permission
 * prompt (never stored, never a persistent/trust-bearing use of location),
 * then the server sorts by haversine distance same as Sparring's existing
 * radius search. Rows with no coordinates just don't show up. Reused as-is
 * on both `/clubs` (default) and `/events` via `basePath`. */
export function NearbyToggle({ active, basePath = "/clubs" }: { active: boolean; basePath?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [denied, setDenied] = useState(false);

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`${basePath}?${params.toString()}`);
  }

  function handleClick() {
    if (active) {
      pushParams((params) => {
        params.delete("nearby");
        params.delete("lat");
        params.delete("lng");
      });
      return;
    }

    if (!("geolocation" in navigator)) {
      setDenied(true);
      return;
    }

    setPending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPending(false);
        pushParams((params) => {
          params.set("nearby", "1");
          params.set("lat", String(pos.coords.latitude));
          params.set("lng", String(pos.coords.longitude));
        });
      },
      () => {
        setPending(false);
        setDenied(true);
      },
      { timeout: 8000 },
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={[
        "shrink-0 rounded-pill px-4 py-2 text-sm font-medium border disabled:opacity-60",
        active ? "bg-ink text-void border-ink" : "border-white/15 text-mute",
      ].join(" ")}
    >
      {pending ? "Locating…" : denied ? "Location unavailable" : "Nearby"}
    </button>
  );
}
