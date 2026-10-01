import Link from "next/link";

const TABS = [
  { key: "home", href: "/club", label: "Home" },
  { key: "events", href: "/club/events", label: "Events" },
  { key: "fighters", href: "/club/fighters", label: "Fighters" },
  { key: "sparring", href: "/club/sparring", label: "Sparring" },
  { key: "requests", href: "/club/requests", label: "Requests" },
  { key: "organizer", href: "/club/organizer", label: "Organizer" },
] as const;

/** Shared sub-nav for the six /club pages — same pill pattern as
 * components/sparring/SparringNav.tsx. Only rendered once a club is
 * resolved (the create/claim flow for a clubless user has no nav). */
export function ClubNav({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="flex gap-2 overflow-x-auto text-sm pb-1">
      {TABS.map((tab) =>
        tab.key === active ? (
          <span key={tab.key} className="shrink-0 rounded-pill border border-signal bg-signal/10 px-4 py-2 font-medium whitespace-nowrap">
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.key}
            href={tab.href}
            className="shrink-0 rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap"
          >
            {tab.label}
          </Link>
        ),
      )}
    </nav>
  );
}
