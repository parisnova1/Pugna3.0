"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/hat";
import { notifyMany } from "@/lib/actions/notify";

export async function createSparringPost(formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const clubId = String(formData.get("clubId") ?? "");
  const gate = can(actor, "club.admin", { clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const gym = String(formData.get("gym") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "");
  const weightWindow = String(formData.get("weightWindow") ?? "").trim();
  const spots = Math.max(1, Number(formData.get("spots") ?? 1));
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!gym || !dateStr || !weightWindow) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "Gym, date, and weight window are required." };
  }

  await prisma.sparringPost.create({
    data: { clubId, gym, date: new Date(dateStr), weightWindow, spots, note },
  });

  revalidatePath("/club/sparring");
  return { ok: true };
}

export async function closeSparringPost(postId: string, clubId: string): Promise<ActionResult> {
  const actor = await getActor();
  const gate = can(actor, "club.admin", { clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  await prisma.sparringPost.update({ where: { id: postId }, data: { status: "CLOSED" } });
  revalidatePath("/club/sparring");
  return { ok: true };
}

export async function requestSparring(formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const requestingClubId = String(formData.get("requestingClubId") ?? "");
  const gate = can(actor, "club.admin", { clubId: requestingClubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const postId = String(formData.get("postId") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  const post = await prisma.sparringPost.findUnique({ where: { id: postId }, include: { club: { include: { admins: true } } } });
  if (!post) return { ok: false, code: "NOT_FOUND", reason: "Post not found." };
  if (post.clubId === requestingClubId) {
    return { ok: false, code: "VALIDATION_BLOCKED", reason: "You can't request your own post." };
  }

  const existing = await prisma.sparringRequest.findUnique({
    where: { postId_requestingClubId: { postId, requestingClubId } },
  });
  if (existing) return { ok: false, code: "CONFLICT", reason: "You already requested this session." };

  const requestingClub = await prisma.club.findUnique({ where: { id: requestingClubId } });

  await prisma.sparringRequest.create({ data: { postId, requestingClubId, note } });

  await notifyMany(
    post.club.admins.map((a) => a.userId),
    "SPARRING_REQUESTED",
    `${requestingClub?.name ?? "A club"} wants to spar at ${post.gym}.`,
    "/club/sparring",
  );

  revalidatePath("/club/sparring");
  return { ok: true };
}

export async function respondToSparringRequest(requestId: string, accept: boolean): Promise<ActionResult> {
  const actor = await getActor();

  const request = await prisma.sparringRequest.findUnique({
    where: { id: requestId },
    include: { post: { include: { club: { include: { admins: true } } } }, requestingClub: { include: { admins: true } } },
  });
  if (!request) return { ok: false, code: "NOT_FOUND", reason: "Request not found." };

  const gate = can(actor, "club.admin", { clubId: request.post.clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  await prisma.sparringRequest.update({
    where: { id: requestId },
    data: { status: accept ? "ACCEPTED" : "DECLINED" },
  });

  await notifyMany(
    request.requestingClub.admins.map((a) => a.userId),
    accept ? "SPARRING_ACCEPTED" : "SPARRING_DECLINED",
    accept
      ? `${request.post.club.name} accepted your sparring request at ${request.post.gym}.`
      : `${request.post.club.name} declined your sparring request at ${request.post.gym}.`,
    "/club/sparring",
  );

  revalidatePath("/club/sparring");
  return { ok: true };
}
