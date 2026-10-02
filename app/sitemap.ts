import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";
import { UNPUBLISHED_EVENT_STATUSES } from "@/lib/event-status";

// Always reflects the current database; crawlers fetch this rarely, and it
// avoids the build needing a live DB connection.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const unpublished = [...UNPUBLISHED_EVENT_STATUSES];
  const publicBout = { event: { status: { notIn: unpublished } } };

  const [events, clubs, fighters] = await Promise.all([
    prisma.event.findMany({
      where: { slug: { not: null }, status: { notIn: unpublished } },
      select: { slug: true, updatedAt: true },
      orderBy: { date: "desc" },
    }),
    prisma.club.findMany({ select: { id: true, updatedAt: true } }),
    // Only fighters with a public competitive record -- same data already
    // visible on published event pages, never a bare account.
    prisma.fighterProfile.findMany({
      where: { OR: [{ boutsAsFighterA: { some: publicBout } }, { boutsAsFighterB: { some: publicBout } }] },
      select: { id: true, updatedAt: true },
    }),
  ]);

  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/events"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/clubs"), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/sparring"), changeFrequency: "daily", priority: 0.6 },
    ...events.map((e) => ({
      url: absoluteUrl(`/e/${e.slug}`),
      lastModified: e.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...clubs.map((c) => ({
      url: absoluteUrl(`/clubs/${c.id}`),
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...fighters.map((f) => ({
      url: absoluteUrl(`/fighters/${f.id}`),
      lastModified: f.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
