"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Hat } from "@prisma/client";

type Tab = { label: string; href: string; prominent?: boolean };

function tabsFor(activeHat: Hat | null): Tab[] {
  switch (activeHat) {
    case "FIGHTER":
      return [
        { label: "You", href: "/you" },
        { label: "Noms", href: "/you/noms" },
        { label: "Fights", href: "/you/fights" },
        { label: "History", href: "/you/history" },
        { label: "Account", href: "/account" },
      ];
    case "CLUB":
      return [
        { label: "Club", href: "/club" },
        { label: "Events", href: "/club/events" },
        { label: "Roster", href: "/club/roster" },
        { label: "Sparring", href: "/club/sparring" },
        { label: "Account", href: "/account" },
      ];
    case "ORGANIZER":
      return [
        { label: "Host", href: "/host" },
        { label: "Events", href: "/host/events" },
        { label: "Live", href: "/host/events/live" },
        { label: "Results", href: "/host/results" },
        { label: "Account", href: "/account" },
      ];
    default:
      return [
        { label: "Discover", href: "/" },
        { label: "Events", href: "/events" },
        { label: "Scan", href: "/scan", prominent: true },
        { label: "Clubs", href: "/clubs" },
        { label: "Account", href: "/account" },
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
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "flex flex-col items-center justify-center rounded-pill px-3 py-1.5 text-xs transition-colors",
              tab.prominent
                ? "bg-signal text-onsignal font-semibold px-4"
                : active
                  ? "text-ink"
                  : "text-mute",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
