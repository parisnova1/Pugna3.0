"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompassIcon, CalendarIcon, ScanIcon, BuildingIcon, PersonIcon, BroadcastIcon } from "@/components/nav/icons";
import type { ComponentType } from "react";
import { isTabActive, type TabId } from "@/lib/nav";

type Tab = { id: TabId; label: string; href: string; icon: ComponentType<{ className?: string }>; live?: boolean };

/**
 * One fixed tab set for every route and every viewer, signed in or not —
 * except the middle slot, which becomes "Control" for organizers instead of
 * "Scan" (still 5 tabs, never a 6th). This is the one deliberate exception to
 * the "nav is route-based, never capability-based" rule in lib/rbac.ts: the
 * capability check happens once, in the (shell) layout, and is passed in as
 * plain props — TabBar itself still does zero data-fetching of its own.
 */
const HOME: Tab = { id: "home", label: "Explore", href: "/", icon: CompassIcon };
const EVENTS: Tab = { id: "events", label: "Events", href: "/events", icon: CalendarIcon };
const SCAN: Tab = { id: "scan", label: "Scan", href: "/scan", icon: ScanIcon };
const CLUBS: Tab = { id: "clubs", label: "Clubs", href: "/clubs", icon: BuildingIcon };
const ACCOUNT: Tab = { id: "account", label: "Account", href: "/account", icon: PersonIcon };

const VIEWER_TABS: Tab[] = [HOME, EVENTS, SCAN, CLUBS, ACCOUNT];

export function TabBar({ isOrganizer = false, liveEventId = null }: { isOrganizer?: boolean; liveEventId?: string | null }) {
  const pathname = usePathname();

  const controlTab: Tab = {
    id: "control",
    label: "Control",
    href: liveEventId ? `/host/events/${liveEventId}/live` : "/host",
    icon: BroadcastIcon,
    live: Boolean(liveEventId),
  };

  const tabs: Tab[] = isOrganizer ? [HOME, EVENTS, controlTab, CLUBS, ACCOUNT] : VIEWER_TABS;

  return (
    <nav aria-label="Main" className="glass !bg-panel fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
      {tabs.map((tab) => {
        const active = isTabActive(tab.id, pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={[
              "relative flex flex-col items-center justify-center gap-0.5 rounded-pill px-3 py-1.5 text-[11px] transition-colors",
              active ? "text-ink" : tab.live ? "text-signal-ink" : "text-mute",
            ].join(" ")}
          >
            <span className={active ? "rounded-pill bg-signal/10 p-1.5 -m-1.5" : undefined}>
              <Icon className="shrink-0" />
              {tab.live && <span className="live-pulse absolute top-0.5 right-1.5 w-1.5 h-1.5 rounded-full bg-live" />}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
