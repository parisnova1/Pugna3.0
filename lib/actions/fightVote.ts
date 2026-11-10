"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { isPublishedEventStatus } from "@/lib/event-status";
import { clientIp } from "@/lib/security/client-ip";
import { POLICIES } from "@/lib/security/policies";
import { rateLimit } from "@/lib/security/rate-limit-db";
import { retryMessage } from "@/lib/security/rate-limit";
import { isVotableBoutStatus, isVotingOpen, voterKeyFor, VOTER_COOKIE, VOTER_COOKIE_MAX_AGE } from "@/lib/fight-vote";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Casts (or moves) the caller's one "fight of the day" vote for the bout's
 * event day. Open to guests on purpose: the audience votes from a QR code in
 * the hall, so a signed-in user is keyed by account and everyone else by a
 * random httpOnly cookie. Voting again for the same bout is a no-op; voting
 * for another bout on the same day moves the vote.
 */
export async function voteFightOfDay(boutId: string): Promise<ActionResult> {
  const bout = await prisma.bout.findUnique({
    where: { id: boutId },
    select: { id: true, day: true, status: true, eventId: true, event: { select: { slug: true, status: true } } },
  });
  // Unpublished events answer exactly like a missing bout, so a draft card can't be probed.
  if (!bout || !isPublishedEventStatus(bout.event.status)) {
    return { ok: false, code: "NOT_FOUND", reason: "Fight not found." };
  }
  if (!isVotingOpen(bout.event.status)) {
    return { ok: false, code: "CONFLICT", reason: "Voting is closed for this event." };
  }
  if (!isVotableBoutStatus(bout.status)) {
    return { ok: false, code: "CONFLICT", reason: "You can vote once this fight has started." };
  }

  const actor = await getActor();
  const jar = await cookies();
  let guestId = jar.get(VOTER_COOKIE)?.value ?? null;
  if (!actor && !guestId) {
    guestId = nanoid(32);
    jar.set(VOTER_COOKIE, guestId, {
      path: "/",
      maxAge: VOTER_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  const voterKey = voterKeyFor({ userId: actor?.userId, guestId });
  if (!voterKey) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Could not register your vote. Try again." };

  const limit = await rateLimit([
    { policy: POLICIES.fightVoteIp, subject: clientIp(await headers()) },
    { policy: POLICIES.fightVoteVoter, subject: voterKey },
  ]);
  if (!limit.ok) return { ok: false, code: "RATE_LIMITED", reason: retryMessage(limit.retryAfterSec) };

  await prisma.fightOfDayVote.upsert({
    where: { eventId_day_voterKey: { eventId: bout.eventId, day: bout.day, voterKey } },
    update: { boutId: bout.id },
    create: { eventId: bout.eventId, day: bout.day, boutId: bout.id, voterKey },
  });

  if (bout.event.slug) revalidatePath(`/e/${bout.event.slug}`);
  return { ok: true };
}
