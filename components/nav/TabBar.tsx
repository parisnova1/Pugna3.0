"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CompassIcon,
  CalendarIcon,
  ScanIcon,
  BuildingIcon,
  PersonIcon,
  GloveIcon,
  ListIcon,
  FlagIcon,
  BroadcastIcon,
  TrophyIcon,
} from "@/components/nav/icons";
import type { ComponentType } from "react";

type Tab = { label: string; href: string; icon: ComponentType<{ className?: string }>; prominent?: boolean };

/**
 * Navigation is a pure function of the current route — never of the user's
 * capabilities. A Boxer who also admins a Club sees Boxer nav on /you/* and
 * Club nav on /club/*; there is no "active role" to pick between. Neutral
 * routes (Discover/Events/Scan/Clubs/Account) show the same bar to everyone,
 * signed in or not.
 */
function isInSection(pathname: string, section: string): boolean {
  return pathname === section || pathname.startsWith(`${section}/`);
}

function tabsFor(pathname: string): Tab[] {
  if (isInSection(pathname, "/club")) {
    return [
      { label: "Club", href: "/club", icon: BuildingIcon },
      { label: "Tournaments", href: "/club/tournaments", icon: CalendarIcon },
      { label: "Roster", href: "/club/roster", icon: ListIcon },
      { label: "Requests", href: "/club/requests", icon: GloveIcon },
      { label: "Account", href: "/account", icon: PersonIcon },
    ];
  }

  if (isInSection(pathname, "/host")) {
    return [
      { label: "Dashboard", href: "/host", icon: FlagIcon },
      { label: "Events", href: "/host/events", icon: CalendarIcon },
      { label: "Live", href: "/host/events/live", icon: BroadcastIcon },
      { label: "Results", href: "/host/results", icon: TrophyIcon },
      { label: "Account", href: "/account", icon: PersonIcon },
    ];
  }

  if (isInSection(pathname, "/you")) {
    return [
      { label: "Home", href: "/you", icon: PersonIcon },
      { label: "My Fights", href: "/you/fights", icon: GloveIcon },
      { label: "Events", href: "/events", icon: CalendarIcon },
      { label: "Scan", href: "/scan", icon: ScanIcon, prominent: true },
      { label: "Account", href: "/account", icon: PersonIcon },
    ];
  }

  // Neutral — Discover, Events, Scan, Clubs, Account, and anything else.
  return [
    { label: "Discover", href: "/", icon: CompassIcon },
    { label: "Events", href: "/events", icon: CalendarIcon },
    { label: "Scan", href: "/scan", icon: ScanIcon, prominent: true },
    { label: "Clubs", href: "/clubs", icon: BuildingIcon },
    { label: "Account", href: "/account", icon: PersonIcon },
  ];
}

export function TabBar() {
  const pathname = usePathname();
  const tabs = tabsFor(pathname);

  return (
    <nav className="glass fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
      {tabs.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "flex flex-col items-center justify-center gap-0.5 rounded-pill px-3 py-1.5 text-[11px] transition-colors",
              tab.prominent
                ? "bg-signal text-onsignal font-semibold px-4 -mt-1"
                : active
                  ? "text-ink"
                  : "text-mute",
            ].join(" ")}
          >
            <Icon className="shrink-0" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
