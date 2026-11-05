export type TabId = "home" | "events" | "scan" | "clubs" | "account" | "control";

/**
 * Which routes belong to which bottom-nav tab. Matching is by whole path
 * segment, so "/club/events" lights up Clubs but "/clubs" is never mistaken for
 * a prefix of anything else. "/" is an exact match only.
 *
 * Routes that no tab owns (sparring, search, fighter profiles) are reached
 * from Explore, so that is where they belong.
 */
const OWNED_ROUTES: Record<TabId, readonly string[]> = {
  home: ["/sparring", "/search", "/fighters"],
  events: ["/events"],
  scan: ["/scan"],
  clubs: ["/clubs", "/club"],
  account: ["/account", "/you", "/become-boxer"],
  control: ["/host"],
};

const within = (pathname: string, route: string) => pathname === route || pathname.startsWith(`${route}/`);

export function isTabActive(tab: TabId, pathname: string): boolean {
  if (tab === "home" && pathname === "/") return true;
  return OWNED_ROUTES[tab].some((route) => within(pathname, route));
}
