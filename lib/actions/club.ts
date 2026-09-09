"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";

export async function createClub(formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, code: "AUTH_REQUIRED", reason: "Sign in required." };

  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim() || null;
  if (!name) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Club name is required." };

  const club = await prisma.club.create({ data: { name, city } });
  await prisma.clubAdmin.create({ data: { clubId: club.id, userId: actor.userId } });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function claimClub(clubId: string): Promise<ActionResult> {
  const actor = await getActor();
  const club = await prisma.club.findUnique({ where: { id: clubId }, include: { admins: true } });
  const gate = can(actor, "club.claim", { clubClaimed: (club?.admins.length ?? 0) > 0 });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };
  if (!club) return { ok: false, code: "NOT_FOUND", reason: "Club not found." };

  await prisma.clubAdmin.create({ data: { clubId, userId: actor!.userId } });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addRosterFighter(formData: FormData): Promise<ActionResult> {
  const actor = await getActor();
  const clubId = String(formData.get("clubId") ?? "");
  const gate = can(actor, "club.admin", { clubId });
  if (!gate.allowed) return { ok: false, code: gate.code, reason: gate.reason };

  const displayName = String(formData.get("name") ?? "").trim();
  const weightClass = String(formData.get("weightClass") ?? "").trim() || null;
  if (!displayName) return { ok: false, code: "VALIDATION_BLOCKED", reason: "Boxer name is required." };

  const placeholderEmail = `roster.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@pugna.local`;
  const placeholderUser = await prisma.user.create({
    data: { email: placeholderEmail, passwordHash: "GUEST_NO_LOGIN", name: displayName },
  });

  await prisma.fighterProfile.create({
    data: { userId: placeholderUser.id, displayName, weightClass, clubId },
  });

  revalidatePath("/club/roster");
  return { ok: true };
}
