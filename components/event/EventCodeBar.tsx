"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/** Enter an event's share code (from its QR or a host) to jump straight to it. */
export function EventCodeBar() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <div className="flex gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = code.trim();
          if (trimmed) router.push(`/go/${encodeURIComponent(trimmed)}`);
        }}
        className="relative flex-1"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter event code"
          className="w-full rounded-pill bg-panel border border-white/10 pl-4 pr-11 py-2.5 text-sm text-ink placeholder:text-mute"
        />
        <button
          type="submit"
          aria-label="Go to event"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-signal text-onsignal w-8 h-8 flex items-center justify-center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>

      <Link
        href="/scan"
        aria-label="Scan QR"
        className="shrink-0 rounded-pill border border-white/20 w-11 flex items-center justify-center"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" />
        </svg>
      </Link>
    </div>
  );
}
