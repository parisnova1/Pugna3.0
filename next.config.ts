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

const nextConfig: NextConfig = {
  typedRoutes: false,
  async headers() {
    return PRIVATE_ROUTE_SOURCES.map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));
  },
};

export default nextConfig;
