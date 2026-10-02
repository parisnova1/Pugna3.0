import { prisma } from "@/lib/prisma";

/**
 * Plain server-side helpers that resolve notification recipients. They live
 * outside the "use server" action files on purpose: every export of a
 * "use server" module is a remotely callable endpoint, and these return user
 * ids with no authorization check -- they must only ever be called from other
 * server code that has already authorized the request.
 */

export async function getBoutFighterUserIds(eventId: string): Promise<string[]> {
  const bouts = await prisma.bout.findMany({
    where: { eventId },
    include: { fighterA: true, fighterB: true },
  });
  const ids = bouts.flatMap((b) => [b.fighterA?.userId, b.fighterB?.userId]).filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

export async function getFollowerUserIds(eventId: string): Promise<string[]> {
  const follows = await prisma.follow.findMany({ where: { eventId }, select: { userId: true } });
  return follows.map((f) => f.userId);
}

export async function clubAdminUserIds(clubId: string): Promise<string[]> {
  const admins = await prisma.clubAdmin.findMany({ where: { clubId }, select: { userId: true } });
  return admins.map((a) => a.userId);
}
