import Link from "next/link";

const TABS = [
  { key: "discover", href: "/sparring", label: "Discover", requiresAuth: false },
  { key: "mine", href: "/sparring/mine", label: "My Sparring", requiresAuth: true },
  { key: "host", href: "/sparring/host", label: "Host", requiresAuth: false },
  { key: "requests", href: "/sparring/requests", label: "Requests", requiresAuth: true },
] as const;

/** Shared sub-nav for the four /sparring pages. My Sparring / Requests only
 * show once the viewer is signed in — both redirect guests to /account
 * anyway, so showing them as live tabs to a guest is a dead end. */
export function SparringNav({ active, registered }: { active: (typeof TABS)[number]["key"]; registered: boolean }) {
  return (
    <nav className="flex gap-2 overflow-x-auto text-sm">
      {TABS.filter((tab) => registered || !tab.requiresAuth).map((tab) =>
        tab.key === active ? (
          <span key={tab.key} className="rounded-pill border border-signal bg-signal/10 px-4 py-2 font-medium whitespace-nowrap">
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.key}
            href={tab.href}
            className="rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap"
          >
            {tab.label}
          </Link>
        ),
      )}
    </nav>
  );
}
