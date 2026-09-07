"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Hat } from "@prisma/client";
import {
  CompassIcon,
  CalendarIcon,
  ScanIcon,
  BuildingIcon,
  PersonIcon,
  BellIcon,
  GloveIcon,
  ClockIcon,
  ListIcon,
  SwapIcon,
  FlagIcon,
  BroadcastIcon,
  TrophyIcon,
} from "@/components/nav/icons";
import type { ComponentType } from "react";

type Tab = { label: string; href: string; icon: ComponentType<{ className?: string }>; prominent?: boolean };

function tabsFor(activeHat: Hat | null): Tab[] {
  switch (activeHat) {
    case "FIGHTER":
      return [
        { label: "You", href: "/you", icon: PersonIcon },
        { label: "Noms", href: "/you/noms", icon: BellIcon },
        { label: "Fights", href: "/you/fights", icon: GloveIcon },
        { label: "History", href: "/you/history", icon: ClockIcon },
        { label: "Account", href: "/account", icon: PersonIcon },
      ];
    case "CLUB":
      return [
        { label: "Club", href: "/club", icon: BuildingIcon },
        { label: "Events", href: "/club/events", icon: CalendarIcon },
        { label: "Roster", href: "/club/roster", icon: ListIcon },
        { label: "Sparring", href: "/club/sparring", icon: SwapIcon },
        { label: "Account", href: "/account", icon: PersonIcon },
      ];
    case "ORGANIZER":
      return [
        { label: "Host", href: "/host", icon: FlagIcon },
        { label: "Events", href: "/host/events", icon: CalendarIcon },
        { label: "Live", href: "/host/events/live", icon: BroadcastIcon },
        { label: "Results", href: "/host/results", icon: TrophyIcon },
        { label: "Account", href: "/account", icon: PersonIcon },
      ];
    default:
      return [
        { label: "Discover", href: "/", icon: CompassIcon },
        { label: "Events", href: "/events", icon: CalendarIcon },
        { label: "Scan", href: "/scan", icon: ScanIcon, prominent: true },
        { label: "Clubs", href: "/clubs", icon: BuildingIcon },
        { label: "Account", href: "/account", icon: PersonIcon },
      ];
  }
}

export function TabBar({ activeHat }: { activeHat: Hat | null }) {
  const pathname = usePathname();
  const tabs = tabsFor(activeHat);

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
