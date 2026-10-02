import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { UNPUBLISHED_EVENT_STATUSES } from "@/lib/seo";

/**
 * Narrow, cached reads used only for metadata. `select` keeps them to fields
 * already shown on the public page, so metadata can never leak anything the
 * page itself wouldn't.
 */

export const getEventMeta = cache(async (slug: string) => {
  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      sport: true,
      status: true,
      date: true,
      startTime: true,
      dayCount: true,
      venue: true,
      city: true,
      latitude: true,
      longitude: true,
      organizingClub: { select: { id: true, name: true } },
      createdBy: { select: { organizerProfile: { select: { displayName: true } } } },
    },
  });
  if (!event) return null;
  const cover = await prisma.media.findFirst({
    where: { attachedType: "EVENT", attachedId: event.id, kind: "EVENT_COVER" },
    orderBy: { createdAt: "desc" },
    select: { url: true },
  });
  return { ...event, coverUrl: cover?.url ?? null };
});

export const getClubMeta = cache(async (id: string) => {
  const club = await prisma.club.findUnique({
    where: { id },
    select: { id: true, name: true, city: true, sport: true, description: true, latitude: true, longitude: true },
  });
  if (!club) return null;
  const cover = await prisma.media.findFirst({
    where: { attachedType: "CLUB", attachedId: club.id, kind: "CLUB_COVER" },
    orderBy: { createdAt: "desc" },
    select: { url: true },
  });
  return { ...club, coverUrl: cover?.url ?? null };
});

/**
 * A fighter profile is only worth indexing once it carries a public
 * competitive record, i.e. a bout in an event guests can already see.
 */
export const getFighterMeta = cache(async (id: string) => {
  const fighter = await prisma.fighterProfile.findUnique({
    where: { id },
    select: { id: true, displayName: true, weightClass: true, club: { select: { id: true, name: true } } },
  });
  if (!fighter) return null;
  const [avatar, publicBoutCount] = await Promise.all([
    prisma.media.findFirst({
      where: { attachedType: "FIGHTER", attachedId: fighter.id, kind: "FIGHTER_AVATAR" },
      orderBy: { createdAt: "desc" },
      select: { url: true },
    }),
    prisma.bout.count({
      where: {
        OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }],
        event: { status: { notIn: [...UNPUBLISHED_EVENT_STATUSES] } },
      },
    }),
  ]);
  return { ...fighter, avatarUrl: avatar?.url ?? null, publicBoutCount };
});

export const getBoutMeta = cache(async (slug: string, boutId: string) => {
  const bout = await prisma.bout.findUnique({
    where: { id: boutId },
    select: {
      id: true,
      number: true,
      weightClass: true,
      status: true,
      fighterA: { select: { displayName: true } },
      fighterB: { select: { displayName: true } },
      result: { select: { winnerId: true, method: true } },
      fighterAId: true,
      fighterBId: true,
      event: { select: { slug: true, name: true, status: true } },
    },
  });
  if (!bout || bout.event.slug !== slug) return null;
  return bout;
});
