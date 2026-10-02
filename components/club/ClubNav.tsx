import { PillNav } from "@/components/ui/PillNav";

const TABS = [
  { key: "home", href: "/club", label: "Home" },
  { key: "events", href: "/club/events", label: "Events" },
  { key: "fighters", href: "/club/fighters", label: "Fighters" },
  { key: "sparring", href: "/club/sparring", label: "Sparring" },
  { key: "requests", href: "/club/requests", label: "Requests" },
  { key: "organizer", href: "/club/organizer", label: "Organizer" },
] as const;

/** Shared sub-nav for the six /club pages. Only rendered once a club is
 * resolved (the create/claim flow for a clubless user has no nav). */
export function ClubNav({ active }: { active: (typeof TABS)[number]["key"] }) {
  return <PillNav items={TABS} active={active} className="pb-1" />;
}
