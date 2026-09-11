"use client";

import { useRouter } from "next/navigation";

/** `fallbackHref` is used only when there's no real in-app history to go
 * back to (e.g. the page was opened directly) — `router.back()` alone would
 * be inert or unpredictable in that case. Every existing call site keeps its
 * current behavior since the default (`/`) only ever kicks in on that edge
 * case. */
export function BackButton({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button onClick={handleClick} aria-label="Go back" className="rounded-full border border-white/15 p-2.5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}
