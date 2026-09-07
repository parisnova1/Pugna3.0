import { customAlphabet } from "nanoid";

const codeAlphabet = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 8);

export function slugify(name: string, date: Date): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const year = date.getFullYear();
  return `${base}-${year}`;
}

export function generateEventCode(): string {
  return codeAlphabet();
}
