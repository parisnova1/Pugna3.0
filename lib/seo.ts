import type { Metadata } from "next";

export const SITE_NAME = "PUGNA";
export const SITE_DESCRIPTION =
  "Combat sports, all in one place. Follow live events, find sparring, and discover clubs and fighters.";
export const DEFAULT_OG_IMAGE = "/onboarding-hero.jpg";

const FALLBACK_SITE_URL = "https://pugna3-0.vercel.app";

/** Absolute origin used for canonical URLs, OG tags, sitemap and JSON-LD. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;
  return FALLBACK_SITE_URL;
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${siteUrl()}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

/** Collapse whitespace and trim to a search-snippet-friendly length. */
export function toDescription(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

export const NOINDEX: Metadata["robots"] = { index: false, follow: false };

type BuildMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article" | "profile";
  noindex?: boolean;
};

/**
 * One place that decides canonical + OG + Twitter for a public page, so every
 * route emits the same shape and none of them can forget a piece.
 */
export function buildMetadata({ title, description, path, image, type = "website", noindex }: BuildMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const ogImage = absoluteUrl(image || DEFAULT_OG_IMAGE);
  const desc = toDescription(description);
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    robots: noindex ? NOINDEX : undefined,
    openGraph: {
      title,
      description: desc,
      url,
      siteName: SITE_NAME,
      type,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [ogImage],
    },
  };
}

/** Generic metadata for a page that exists but must not leak its details. */
export function privateMetadata(title = "PUGNA"): Metadata {
  return { title, robots: NOINDEX };
}

// ---------------------------------------------------------------------------
// Structured data (schema.org JSON-LD)
// ---------------------------------------------------------------------------

type JsonLdValue = string | number | boolean | null | undefined | JsonLdObject | JsonLdValue[];
export type JsonLdObject = { [key: string]: JsonLdValue };

/** Drop null/undefined/empty values so the output contains only real data. */
function compact(obj: JsonLdObject): JsonLdObject {
  const out: JsonLdObject = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === "") continue;
    out[key] = value;
  }
  return out;
}

/** Serialize for a <script type="application/ld+json"> without allowing "</script>" breakout. */
export function serializeJsonLd(data: JsonLdObject): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function websiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: SITE_NAME, url: siteUrl(), description: SITE_DESCRIPTION },
      { "@type": "Organization", name: SITE_NAME, url: siteUrl(), logo: absoluteUrl("/icon.svg") },
    ],
  };
}

type EventLdInput = {
  slug: string;
  name: string;
  description: string | null;
  sport: string;
  status: string;
  date: Date;
  startTime: Date | null;
  dayCount: number;
  venue: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  image: string | null;
  organizerName: string | null;
  organizerUrl: string | null;
  organizerType: "Organization" | "Person";
};

const EVENT_STATUS_URL: Record<string, string> = {
  CANCELLED: "https://schema.org/EventCancelled",
};

export function sportsEventJsonLd(input: EventLdInput): JsonLdObject {
  const start = input.startTime ?? input.date;
  const end = new Date(input.date);
  end.setDate(end.getDate() + Math.max(1, input.dayCount) - 1);

  const location =
    input.venue || input.city
      ? compact({
          "@type": "Place",
          name: input.venue ?? input.city,
          address: input.city ? { "@type": "PostalAddress", addressLocality: input.city } : undefined,
          geo:
            input.latitude != null && input.longitude != null
              ? { "@type": "GeoCoordinates", latitude: input.latitude, longitude: input.longitude }
              : undefined,
        })
      : undefined;

  return compact({
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: input.name,
    description: input.description,
    sport: input.sport,
    url: absoluteUrl(`/e/${input.slug}`),
    startDate: start.toISOString(),
    endDate: input.dayCount > 1 ? end.toISOString() : undefined,
    eventStatus: EVENT_STATUS_URL[input.status] ?? "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location,
    image: input.image ? [absoluteUrl(input.image)] : undefined,
    organizer: input.organizerName
      ? compact({ "@type": input.organizerType, name: input.organizerName, url: input.organizerUrl })
      : undefined,
  });
}

type ClubLdInput = {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  image: string | null;
};

export function clubJsonLd(input: ClubLdInput): JsonLdObject {
  return compact({
    "@context": "https://schema.org",
    "@type": "SportsClub",
    name: input.name,
    description: input.description,
    url: absoluteUrl(`/clubs/${input.id}`),
    image: input.image ? absoluteUrl(input.image) : undefined,
    address: input.city ? { "@type": "PostalAddress", addressLocality: input.city } : undefined,
    geo:
      input.latitude != null && input.longitude != null
        ? { "@type": "GeoCoordinates", latitude: input.latitude, longitude: input.longitude }
        : undefined,
  });
}

type FighterLdInput = {
  id: string;
  name: string;
  image: string | null;
  clubId: string | null;
  clubName: string | null;
};

/** Deliberately minimal: name, photo and club only -- no DOB, sex, or contact data. */
export function fighterJsonLd(input: FighterLdInput): JsonLdObject {
  return compact({
    "@context": "https://schema.org",
    "@type": "Person",
    name: input.name,
    url: absoluteUrl(`/fighters/${input.id}`),
    image: input.image ? absoluteUrl(input.image) : undefined,
    jobTitle: "Boxer",
    affiliation: input.clubName
      ? compact({
          "@type": "SportsClub",
          name: input.clubName,
          url: input.clubId ? absoluteUrl(`/clubs/${input.clubId}`) : undefined,
        })
      : undefined,
  });
}

/** Events whose pages guests are allowed to see (mirrors the "published" rule in rbac `event.view`). */
export const UNPUBLISHED_EVENT_STATUSES = ["DRAFT", "READY"] as const;

export function isPublishedEventStatus(status: string): boolean {
  return !(UNPUBLISHED_EVENT_STATUSES as readonly string[]).includes(status);
}
