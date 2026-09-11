"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompassIcon, CalendarIcon, ScanIcon, BuildingIcon, PersonIcon } from "@/components/nav/icons";
import type { ComponentType } from "react";

type Tab = { label: string; href: string; icon: ComponentType<{ className?: string }> };

/**
 * One fixed tab set for every route and every viewer, signed in or not.
 * Scan is a real tab (not a floating button) — it sits between Events and
 * Clubs, always visible, never overlapping page content. Sparring is reached
 * from Home instead of its own tab. Deep context routes (/club/*, /host/*,
 * /you/*) still work exactly as before; they're just reached via links from
 * Account/Clubs instead of switching the whole tab bar.
 */
const TABS: Tab[] = [
  { label: "Home", href: "/", icon: CompassIcon },
  { label: "Events", href: "/events", icon: CalendarIcon },
  { label: "Scan", href: "/scan", icon: ScanIcon },
  { label: "Clubs", href: "/clubs", icon: BuildingIcon },
  { label: "Account", href: "/account", icon: PersonIcon },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="glass fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        const isScan = tab.href === "/scan";
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "flex flex-col items-center justify-center gap-0.5 rounded-pill px-3 py-1.5 text-[11px] transition-colors",
              active ? "text-ink" : isScan ? "text-signal" : "text-mute",
            ].join(" ")}
          >
            <span className={active ? "rounded-pill bg-signal/10 p-1.5 -m-1.5" : undefined}>
              <Icon className="shrink-0" />
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
