"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MediaAttachedType, MediaKind } from "@prisma/client";

export function MediaUploader({
  kind,
  attachedType,
  attachedId,
  label,
}: {
  kind: MediaKind;
  attachedType: MediaAttachedType;
  attachedId: string;
  label: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("kind", kind);
    formData.set("attachedType", attachedType);
    formData.set("attachedId", attachedId);

    try {
      const res = await fetch("/api/media/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Upload failed.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Upload failed.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="inline-block rounded-pill border border-white/20 text-ink font-medium px-4 py-2 text-sm cursor-pointer">
        {pending ? "Uploading…" : label}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          disabled={pending}
          className="hidden"
        />
      </label>
      {error && <p className="text-signal text-xs mt-1">{error}</p>}
    </div>
  );
}
