"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Wraps a ring's NOW card and watches it with an IntersectionObserver. Once
 * the real card scrolls out of view, a fixed mini bar appears so someone
 * walking around the venue never loses the live bout context; tapping it
 * scrolls back to the real card.
 */
export function StickyLiveBar({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [outOfView, setOutOfView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => setOutOfView(!(entries[0]?.isIntersecting ?? true)), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={ref}>{children}</div>
      {outOfView && (
        <button
          onClick={() => ref.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
          style={{ top: "var(--event-nav-height)" }}
          className="fixed inset-x-0 z-20 mx-auto flex w-full max-w-md items-center gap-2 bg-live px-4 py-3 text-sm font-semibold text-onsignal shadow-lg shadow-black/40"
        >
          <span className="live-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-onsignal" />
          <span className="truncate">{label}</span>
        </button>
      )}
    </>
  );
}
