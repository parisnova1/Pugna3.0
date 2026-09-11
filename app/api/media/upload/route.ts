import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { canManageMedia } from "@/lib/actions/media";
import type { MediaAttachedType, MediaKind } from "@prisma/client";

const KINDS: MediaKind[] = ["EVENT_COVER", "EVENT_GALLERY", "SPONSOR", "BOUT_MEDIA", "SPARRING_MEDIA", "CLUB_COVER"];
const ATTACHED_TYPES: MediaAttachedType[] = ["EVENT", "BOUT", "SPARRING_SESSION", "CLUB"];

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "");
  const attachedType = String(formData.get("attachedType") ?? "");
  const attachedId = String(formData.get("attachedId") ?? "");

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (!KINDS.includes(kind as MediaKind) || !ATTACHED_TYPES.includes(attachedType as MediaAttachedType) || !attachedId) {
    return NextResponse.json({ error: "Invalid upload target." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are supported." }, { status: 400 });
  }

  const actor = await getActor();
  const gate = await canManageMedia(actor, attachedType as MediaAttachedType, attachedId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.reason }, { status: gate.code === "AUTH_REQUIRED" ? 401 : 403 });
  }

  const blob = await put(`media/${attachedType.toLowerCase()}/${attachedId}/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  const media = await prisma.media.create({
    data: {
      url: blob.url,
      kind: kind as MediaKind,
      attachedType: attachedType as MediaAttachedType,
      attachedId,
      uploadedByUserId: actor!.userId,
    },
  });

  return NextResponse.json({ id: media.id, url: media.url });
}
