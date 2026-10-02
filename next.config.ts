import type { NextConfig } from "next";

// Paths that must never be indexed. Mirrors the Disallow list in app/robots.ts;
// the header covers what robots.txt can't (an externally linked URL can still
// be indexed unless it is explicitly marked noindex).
const PRIVATE_ROUTE_SOURCES = [
  "/account/:path*",
  "/host/:path*",
  "/club/:path*",
  "/you/:path*",
  "/scan/:path*",
  "/search/:path*",
  "/become-boxer/:path*",
  "/onboarding/:path*",
  "/checkin/:path*",
  "/in/:path*",
  "/go/:path*",
  "/sparring/:path+",
  "/e/:slug/check-in/:path*",
  "/e/:slug/ring/:path*",
];

// Baseline hardening for every response. Camera and geolocation stay available
// to this origin only (QR scanning, "near me"). A Content-Security-Policy is
// intentionally not set here: it needs a nonce for Next's inline scripts and
// the JSON-LD tags, which is a separate piece of work.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  typedRoutes: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      ...PRIVATE_ROUTE_SOURCES.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};

export default nextConfig;
