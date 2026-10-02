import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  buildMetadata,
  clubJsonLd,
  fighterJsonLd,
  isPublishedEventStatus,
  privateMetadata,
  serializeJsonLd,
  sportsEventJsonLd,
  toDescription,
} from "@/lib/seo";

const baseEvent = {
  slug: "fight-night-2026",
  name: "Fight Night",
  description: null,
  sport: "Boxing",
  status: "PUBLISHED",
  date: new Date("2026-09-18T00:00:00.000Z"),
  startTime: new Date("2026-09-18T17:00:00.000Z"),
  dayCount: 1,
  venue: "City Hall",
  city: "Nürnberg",
  latitude: 49.45,
  longitude: 11.07,
  image: null,
  organizerName: "Noris Club",
  organizerUrl: "https://example.test/clubs/1",
  organizerType: "Organization" as const,
};

describe("buildMetadata", () => {
  const meta = buildMetadata({ title: "Fight Night", description: "A night of boxing.", path: "/e/fight-night-2026" });

  it("sets an absolute canonical URL with no query string", () => {
    expect(meta.alternates?.canonical).toBe(absoluteUrl("/e/fight-night-2026"));
    expect(String(meta.alternates?.canonical)).toMatch(/^https:\/\//);
  });

  it("emits matching Open Graph and Twitter tags", () => {
    expect(meta.openGraph?.title).toBe("Fight Night");
    expect(meta.openGraph?.url).toBe(absoluteUrl("/e/fight-night-2026"));
    expect(meta.twitter?.title).toBe("Fight Night");
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("falls back to the default OG image and never leaves it relative", () => {
    const images = meta.openGraph?.images as { url: string }[];
    expect(images[0]?.url).toMatch(/^https:\/\//);
  });

  it("is indexable by default and noindex when asked", () => {
    expect(meta.robots).toBeUndefined();
    const hidden = buildMetadata({ title: "x", description: "y", path: "/z", noindex: true });
    expect(hidden.robots).toEqual({ index: false, follow: false });
  });
});

describe("privateMetadata", () => {
  it("is noindex and carries no event details", () => {
    const meta = privateMetadata("Event");
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.title).toBe("Event");
    expect(meta.description).toBeUndefined();
    expect(meta.openGraph).toBeUndefined();
  });
});

describe("toDescription", () => {
  it("collapses whitespace and truncates with an ellipsis", () => {
    expect(toDescription("a   b\n c")).toBe("a b c");
    const long = toDescription("x".repeat(400));
    expect(long.length).toBeLessThanOrEqual(160);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("isPublishedEventStatus", () => {
  it("treats DRAFT and READY as unpublished", () => {
    expect(isPublishedEventStatus("DRAFT")).toBe(false);
    expect(isPublishedEventStatus("READY")).toBe(false);
    for (const s of ["PUBLISHED", "LIVE", "INTERMISSION", "FINISHED", "CANCELLED", "ARCHIVED"]) {
      expect(isPublishedEventStatus(s)).toBe(true);
    }
  });
});

describe("sportsEventJsonLd", () => {
  it("produces a SportsEvent with location, organizer and canonical URL", () => {
    const ld = sportsEventJsonLd(baseEvent);
    expect(ld["@type"]).toBe("SportsEvent");
    expect(ld.url).toBe(absoluteUrl("/e/fight-night-2026"));
    expect(ld.startDate).toBe("2026-09-18T17:00:00.000Z");
    expect(ld.eventStatus).toBe("https://schema.org/EventScheduled");
    expect(ld.location).toMatchObject({ "@type": "Place", name: "City Hall" });
    expect(ld.organizer).toMatchObject({ "@type": "Organization", name: "Noris Club" });
  });

  it("marks cancelled events and adds an endDate for multi-day events", () => {
    const ld = sportsEventJsonLd({ ...baseEvent, status: "CANCELLED", dayCount: 3 });
    expect(ld.eventStatus).toBe("https://schema.org/EventCancelled");
    expect(ld.endDate).toBe("2026-09-20T00:00:00.000Z");
  });

  it("omits location and nulls instead of emitting empty values", () => {
    const ld = sportsEventJsonLd({ ...baseEvent, venue: null, city: null, organizerName: null });
    expect(ld).not.toHaveProperty("location");
    expect(ld).not.toHaveProperty("organizer");
    expect(ld).not.toHaveProperty("description");
    expect(Object.values(ld)).not.toContain(null);
    expect(Object.values(ld)).not.toContain(undefined);
  });
});

describe("fighterJsonLd / clubJsonLd", () => {
  it("fighter structured data exposes only name, photo and club", () => {
    const ld = fighterJsonLd({ id: "f1", name: "Alex Rivera", image: null, clubId: "c1", clubName: "Isar Boxclub" });
    expect(ld["@type"]).toBe("Person");
    expect(Object.keys(ld).sort()).toEqual(["@context", "@type", "affiliation", "jobTitle", "name", "url"]);
  });

  it("club structured data is a SportsClub with its canonical URL", () => {
    const ld = clubJsonLd({
      id: "c1",
      name: "Isar Boxclub",
      description: null,
      city: "München",
      latitude: null,
      longitude: null,
      image: null,
    });
    expect(ld["@type"]).toBe("SportsClub");
    expect(ld.url).toBe(absoluteUrl("/clubs/c1"));
    expect(ld).not.toHaveProperty("geo");
  });
});

describe("serializeJsonLd", () => {
  it("cannot be broken out of its <script> tag by user-supplied text", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});
