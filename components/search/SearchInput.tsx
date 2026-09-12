"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

/** Debounced (plain setTimeout, no library) `?q=` updates — keeps the search page server-rendered
 * instead of adding client-side data fetching. `type` is preserved across edits so switching to a
 * single-entity filter and then typing doesn't reset back to "All". */
export function SearchInput({ initialQuery, type }: { initialQuery: string; type: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleChange(next: string) {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (next.trim()) params.set("q", next.trim());
      if (type !== "all") params.set("type", type);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
  }

  return (
    <div className="relative">
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 text-mute pointer-events-none"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        autoFocus
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search events, boxers, clubs..."
        className="w-full rounded-pill bg-panel border border-white/10 pl-11 pr-4 py-3 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-signal focus:ring-2 focus:ring-signal/20"
      />
    </div>
  );
}
