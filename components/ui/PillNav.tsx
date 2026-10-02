import Link from "next/link";

export type PillNavItem = { key: string; href: string; label: string };

/** Horizontally scrolling sub-navigation: the active tab is a highlighted pill, the rest are links. */
export function PillNav({ items, active, className = "" }: { items: readonly PillNavItem[]; active: string; className?: string }) {
  return (
    <nav className={["flex gap-2 overflow-x-auto text-sm", className].filter(Boolean).join(" ")}>
      {items.map((item) =>
        item.key === active ? (
          <span
            key={item.key}
            className="shrink-0 rounded-pill border border-signal bg-signal/10 px-4 py-2 font-medium whitespace-nowrap"
          >
            {item.label}
          </span>
        ) : (
          <Link
            key={item.key}
            href={item.href}
            className="shrink-0 rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap"
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}
