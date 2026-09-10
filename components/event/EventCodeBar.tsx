"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Enter an event's share code (from its QR or a host) to jump straight to it. */
export function EventCodeBar() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (trimmed) router.push(`/go/${encodeURIComponent(trimmed)}`);
      }}
      className="flex gap-2"
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter event code"
        className="flex-1 rounded-pill bg-panel border border-white/10 px-4 py-2.5 text-sm text-ink placeholder:text-mute"
      />
      <button type="submit" className="rounded-pill border border-white/20 text-ink font-semibold px-4 text-sm">
        Go
      </button>
    </form>
  );
}
