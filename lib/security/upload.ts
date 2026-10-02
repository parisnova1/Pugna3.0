export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type ImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/avif";

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.slice(start, start + length));

/**
 * Identifies an image from its first bytes. The browser-supplied `file.type`
 * is attacker-controlled, so an HTML or SVG payload could be labelled
 * "image/png"; trusting the content instead means only real raster images are
 * stored on the public blob domain. SVG is deliberately not allowed -- it can
 * carry script.
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") return "image/png";
  if (ascii(bytes, 0, 4) === "GIF8") return "image/gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (ascii(bytes, 4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 4))) return "image/avif";
  return null;
}

/** Keeps only safe filename characters and a bounded length, so a name can't inject path segments. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, "_").replace(/\.{2,}/g, ".").slice(-80);
  return cleaned || "upload";
}
