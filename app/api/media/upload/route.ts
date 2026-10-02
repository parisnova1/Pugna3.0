import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { canManageMedia } from "@/lib/actions/media";
import { POLICIES } from "@/lib/security/policies";
import { rateLimit } from "@/lib/security/rate-limit-db";
import { MAX_UPLOAD_BYTES, safeFileName, sniffImageType } from "@/lib/security/upload";
import type { MediaAttachedType, MediaKind } from "@prisma/client";

const KINDS: MediaKind[] = [
  "EVENT_COVER",
  "EVENT_GALLERY",
  "SPONSOR",
  "BOUT_MEDIA",
  "SPARRING_MEDIA",
  "CLUB_COVER",
  "FIGHTER_AVATAR",
  "FIGHTER_MEDIA",
];
const ATTACHED_TYPES: MediaAttachedType[] = ["EVENT", "BOUT", "SPARRING_SESSION", "CLUB", "FIGHTER"];

export async function POST(req: Request) {
  // Authenticate and rate-limit BEFORE reading the body, so an anonymous or
  // abusive caller can't make the server buffer large uploads.
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const limit = await rateLimit([{ policy: POLICIES.uploadUser, subject: actor.userId }]);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "File is too large." }, { status: 413 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "");
  const attachedType = String(formData.get("attachedType") ?? "");
  const attachedId = String(formData.get("attachedId") ?? "");

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is too large (4 MB max)." }, { status: 413 });
  }
  if (!KINDS.includes(kind as MediaKind) || !ATTACHED_TYPES.includes(attachedType as MediaAttachedType) || !attachedId) {
    return NextResponse.json({ error: "Invalid upload target." }, { status: 400 });
  }

  // Trust the bytes, not the browser-declared type.
  const contentType = sniffImageType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!contentType) {
    return NextResponse.json({ error: "Only JPEG, PNG, GIF, WebP or AVIF images are supported." }, { status: 400 });
  }

  const gate = await canManageMedia(actor, attachedType as MediaAttachedType, attachedId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.reason }, { status: gate.code === "AUTH_REQUIRED" ? 401 : 403 });
  }

  const blob = await put(`media/${attachedType.toLowerCase()}/${attachedId}/${Date.now()}-${safeFileName(file.name)}`, file, {
    access: "public",
    contentType,
  });

  const media = await prisma.media.create({
    data: {
      url: blob.url,
      kind: kind as MediaKind,
      attachedType: attachedType as MediaAttachedType,
      attachedId,
      uploadedByUserId: actor.userId,
    },
  });

  return NextResponse.json({ id: media.id, url: media.url });
}
