import { PillNav } from "@/components/ui/PillNav";

const TABS = [
  { key: "discover", href: "/sparring", label: "Discover", requiresAuth: false },
  { key: "mine", href: "/sparring/mine", label: "My Sparring", requiresAuth: true },
  { key: "host", href: "/sparring/host", label: "Host", requiresAuth: false },
  { key: "requests", href: "/club/requests", label: "Requests", requiresAuth: true },
] as const;

/** Shared sub-nav for the four /sparring pages. My Sparring / Requests only
 * show once the viewer is signed in — both redirect guests to /account
 * anyway, so showing them as live tabs to a guest is a dead end. Requests
 * now points at the consolidated Club Requests inbox — sparring requests
 * are one of its categories, not a separate inbox. */
export function SparringNav({ active, registered }: { active: (typeof TABS)[number]["key"]; registered: boolean }) {
  return <PillNav items={TABS.filter((tab) => registered || !tab.requiresAuth)} active={active} />;
}
