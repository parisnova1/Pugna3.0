"use client";

import { useEffect, useState, type ReactNode } from "react";

export type EventTab = { id: string; label: ReactNode; emphasize?: boolean };

/** In-page anchor nav for the event page's sections — no new routes, per the
 * brief. Active section tracked via IntersectionObserver, the same
 * lightweight pattern already used by StickyLiveBar (no polling, no
 * library). Usually rendered inside the sticky `EventStickyNav` wrapper,
 * which is what makes it feel persistent — this component itself doesn't
 * position itself. */
export function EventTabs({ tabs }: { tabs: EventTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const elements = tabs
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-108px 0px -70% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <nav className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1" aria-label="Event sections">
      {tabs.map((t) => (
        <a
          key={t.id}
          href={`#${t.id}`}
          onClick={() => setActive(t.id)}
          className={[
            "shrink-0 rounded-pill px-4 py-2 text-sm font-medium border transition-colors",
            active === t.id
              ? "bg-ink text-void border-ink"
              : t.emphasize
                ? "border-live/40 text-live"
                : "border-white/15 text-mute",
          ].join(" ")}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}
