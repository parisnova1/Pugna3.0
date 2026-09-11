import { prisma } from "@/lib/prisma";
import type { CrowdEmoji } from "@prisma/client";

export type CrowdSnapshot = {
  reactionCounts: { emoji: CrowdEmoji; count: number }[];
  shouts: { id: string; text: string; createdAt: Date }[];
  crowdSize: number;
};

/** Shared by the Live Fight page's initial SSR and its poll endpoint so the
 * two never drift on what "the crowd" means for a bout. */
export async function getCrowdSnapshot(boutId: string): Promise<CrowdSnapshot> {
  const [grouped, shouts, reactors, shouters] = await Promise.all([
    prisma.crowdReaction.groupBy({ by: ["emoji"], where: { boutId }, _count: true }),
    prisma.crowdShout.findMany({
      where: { boutId, hidden: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, text: true, createdAt: true },
    }),
    prisma.crowdReaction.findMany({ where: { boutId }, distinct: ["userId"], select: { userId: true } }),
    prisma.crowdShout.findMany({ where: { boutId, hidden: false }, distinct: ["userId"], select: { userId: true } }),
  ]);

  const crowdSize = new Set([...reactors.map((r) => r.userId), ...shouters.map((s) => s.userId)]).size;

  return {
    reactionCounts: grouped.map((g) => ({ emoji: g.emoji, count: g._count })).sort((a, b) => b.count - a.count),
    shouts,
    crowdSize,
  };
}

/** Which emojis this specific viewer has already tapped on this bout — drives
 * the composer's active/inactive toggle state. */
export async function getMyReactions(boutId: string, userId: string): Promise<CrowdEmoji[]> {
  const rows = await prisma.crowdReaction.findMany({ where: { boutId, userId }, select: { emoji: true } });
  return rows.map((r) => r.emoji);
}
