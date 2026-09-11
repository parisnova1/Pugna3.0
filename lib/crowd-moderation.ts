// Simple substring blocklist for crowd shouts — MVP moderation, not a
// moderation suite. A match auto-hides the shout (it still gets written, for
// the host's record) rather than rejecting the post outright.
const BLOCKLIST = ["fuck", "shit", "bitch", "asshole", "nigger", "faggot", "cunt", "retard"];

export function containsBlockedWord(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKLIST.some((word) => lower.includes(word));
}
