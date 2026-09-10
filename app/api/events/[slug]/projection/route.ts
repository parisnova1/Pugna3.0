import { NextResponse } from "next/server";
import { getEventCardData } from "@/lib/event-query";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ringId = new URL(req.url).searchParams.get("ringId") ?? undefined;
  const data = await getEventCardData(slug, ringId);
  if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const actor = await getActor();
  const published = data.event.status !== "DRAFT" && data.event.status !== "READY";
  const view = can(actor, "event.view", { eventId: data.event.id, eventPublished: published });
  if (!view.allowed) return NextResponse.json({ error: view.code }, { status: 403 });

  return NextResponse.json({
    status: data.event.status,
    nowLabel: data.projection.nowLabel,
    intermissionUntil: data.event.intermissionUntil,
    breakUntil: data.ring?.breakUntil ?? null,
    now: data.projection.now
      ? {
          id: data.projection.now.id,
          number: data.projection.now.number,
          status: data.projection.now.status,
          delayMinutes: data.projection.now.delayMinutes,
          totalRounds: data.projection.now.totalRounds,
          currentRound: data.projection.now.currentRound,
          roundPhase: data.projection.now.roundPhase,
          phaseEndsAt: data.projection.now.phaseEndsAt,
        }
      : null,
    next: data.projection.next
      ? { id: data.projection.next.id, number: data.projection.next.number, status: data.projection.next.status }
      : null,
    bouts: data.bouts.map((b) => ({ id: b.id, number: b.number, status: b.status })),
    followerCount: data.event._count.follows,
    updatedAt: new Date().toISOString(),
  });
}
