import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import nextConfig from "@/next.config";

// Minimal robots.txt matcher: prefix match, "*" wildcard, "$" end anchor.
function matches(rule: string, path: string): boolean {
  const pattern = rule
    .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\$$/, "$");
  return new RegExp(`^${pattern}`).test(path);
}

const rules = robots().rules;
const disallow = (Array.isArray(rules) ? rules[0]?.disallow : rules.disallow) as string[];

const PUBLIC_PATHS = [
  "/",
  "/events",
  "/clubs",
  "/clubs/abc",
  "/fighters/abc",
  "/e/some-event",
  "/e/some-event/bout/123",
  "/sparring",
];
const PRIVATE_PATHS = [
  "/account",
  "/account/settings",
  "/host/events/1/entries",
  "/club",
  "/club/requests",
  "/you/notifications",
  "/scan",
  "/search",
  "/sparring/abc",
  "/sparring/host/new",
  "/e/some-event/check-in",
  "/e/some-event/ring/1",
  "/api/auth/session",
];

describe("robots.txt", () => {
  it("never blocks a public page (guards the /club vs /clubs prefix trap)", () => {
    for (const path of PUBLIC_PATHS) {
      expect(
        disallow.some((rule) => matches(rule, path)),
        path,
      ).toBe(false);
    }
  });

  it("blocks every private area", () => {
    for (const path of PRIVATE_PATHS) {
      expect(
        disallow.some((rule) => matches(rule, path)),
        path,
      ).toBe(true);
    }
  });

  it("advertises the sitemap", () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe("X-Robots-Tag on private routes", () => {
  it("is configured for private paths and never for public ones", async () => {
    const entries = (await nextConfig.headers?.()) ?? [];
    const robotsEntries = entries.filter((e) => e.source !== "/:path*");
    const sources = robotsEntries.map((e) => e.source);
    for (const expected of ["/account/:path*", "/host/:path*", "/club/:path*", "/you/:path*", "/sparring/:path+"]) {
      expect(sources).toContain(expected);
    }
    for (const entry of robotsEntries) {
      expect(entry.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    }
    for (const pub of ["/clubs/:path*", "/events/:path*", "/fighters/:path*", "/sparring"]) {
      expect(sources).not.toContain(pub);
    }
  });
});
