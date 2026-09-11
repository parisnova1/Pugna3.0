import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { getCrowdSnapshot, getMyReactions } from "@/lib/crowd-query";

export async function GET(_req: Request, { params }: { params: Promise<{ boutId: string }> }) {
  const { boutId } = await params;

  const bout = await prisma.bout.findUnique({
    where: { id: boutId },
    include: { event: { include: { _count: { select: { follows: true } } } }, result: true },
  });
  if (!bout) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const actor = await getActor();
  const published = bout.event.status !== "DRAFT" && bout.event.status !== "READY";
  const view = can(actor, "event.view", { eventId: bout.event.id, eventPublished: published });
  if (!view.allowed) return NextResponse.json({ error: view.code }, { status: 403 });

  const [snapshot, checkIn, mute, myReactions] = await Promise.all([
    getCrowdSnapshot(boutId),
    actor
      ? prisma.eventCheckIn.findUnique({ where: { eventId_userId: { eventId: bout.eventId, userId: actor.userId } } })
      : Promise.resolve(null),
    actor
      ? prisma.crowdMute.findUnique({ where: { eventId_userId: { eventId: bout.eventId, userId: actor.userId } } })
      : Promise.resolve(null),
    actor ? getMyReactions(boutId, actor.userId) : Promise.resolve([]),
  ]);

  const writeGate = can(actor, "crowd.write", {
    checkedIn: Boolean(checkIn),
    boutInProgress: bout.status === "IN_PROGRESS",
    muted: Boolean(mute),
  });

  return NextResponse.json({
    status: bout.status,
    delayMinutes: bout.delayMinutes,
    streamUrl: bout.streamUrl,
    eventStreamUrl: bout.event.streamUrl,
    totalRounds: bout.totalRounds,
    currentRound: bout.currentRound,
    roundPhase: bout.roundPhase,
    phaseEndsAt: bout.phaseEndsAt,
    result: bout.result
      ? {
          winnerId: bout.result.winnerId,
          method: bout.result.method,
          round: bout.result.round,
        }
      : null,
    reactionCounts: snapshot.reactionCounts,
    shouts: snapshot.shouts,
    crowdSize: snapshot.crowdSize,
    myReactions,
    checkedIn: Boolean(checkIn),
    canWrite: writeGate.allowed,
    followerCount: bout.event._count.follows,
    updatedAt: new Date().toISOString(),
  });
}
