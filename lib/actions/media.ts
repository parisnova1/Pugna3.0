"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/types";
import { canManageMedia } from "@/lib/media-access";

export async function deleteMedia(mediaId: string): Promise<ActionResult> {
  const actor = await getActor();
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) return { ok: false, code: "NOT_FOUND", reason: "Media not found." };

  const gate = await canManageMedia(actor, media.attachedType, media.attachedId);
  if (!gate.ok) return gate;

  await prisma.media.delete({ where: { id: mediaId } });
  await del(media.url).catch(() => {});

  revalidatePath("/", "layout");
  return { ok: true };
}
