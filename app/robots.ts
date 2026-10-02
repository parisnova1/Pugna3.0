import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// Keep in sync with PRIVATE_ROUTE_SOURCES in next.config.ts, which additionally
// sends X-Robots-Tag: noindex for the same paths (robots.txt alone only stops
// crawling, not indexing of externally linked URLs).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/account",
          "/host",
          "/club/",
          "/club$",
          "/you",
          "/scan",
          "/search",
          "/become-boxer",
          "/onboarding",
          "/checkin/",
          "/in/",
          "/go/",
          "/sparring/",
          "/e/*/check-in",
          "/e/*/ring/",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
