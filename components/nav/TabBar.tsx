"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompassIcon, CalendarIcon, BuildingIcon, PersonIcon, GloveIcon, ScanIcon } from "@/components/nav/icons";
import type { ComponentType } from "react";

type Tab = { label: string; href: string; icon: ComponentType<{ className?: string }> };

/**
 * One fixed tab set for every route and every viewer, signed in or not —
 * Sparring is a first-class top-level product now, not something reached
 * only from inside a Club. Deep context routes (/club/*, /host/*, /you/*)
 * still work exactly as before; they're just reached via links from
 * Profile/Clubs instead of switching the whole tab bar.
 */
const TABS: Tab[] = [
  { label: "Home", href: "/", icon: CompassIcon },
  { label: "Sparring", href: "/sparring", icon: GloveIcon },
  { label: "Events", href: "/events", icon: CalendarIcon },
  { label: "Clubs", href: "/clubs", icon: BuildingIcon },
  { label: "Profile", href: "/account", icon: PersonIcon },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Centered, not right-aligned — a right-aligned FAB sat directly above the
          rightmost "Profile" tab, close enough on some viewports that a tap meant
          for Profile could land on Scan instead. Centering keeps it equally clear
          of every tab. */}
      <Link
        href="/scan"
        aria-label="Scan"
        className="fixed z-50 bottom-24 left-1/2 -translate-x-1/2 flex items-center justify-center w-14 h-14 rounded-full bg-signal text-onsignal shadow-lg shadow-black/40"
      >
        <ScanIcon className="shrink-0" />
      </Link>

      <nav className="glass fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={[
                "flex flex-col items-center justify-center gap-0.5 rounded-pill px-3 py-1.5 text-[11px] transition-colors",
                active ? "text-ink" : "text-mute",
              ].join(" ")}
            >
              <Icon className="shrink-0" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
