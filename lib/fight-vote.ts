import { createHash } from "node:crypto";

/** Cookie holding an anonymous voter's random id (never the vote itself). */
export const VOTER_COOKIE = "pugna_voter";
export const VOTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Bouts people can vote for: ones that have actually started or finished. */
export const VOTABLE_BOUT_STATUSES = ["IN_PROGRESS", "FINAL"] as const;

export function isVotableBoutStatus(status: string): boolean {
  return (VOTABLE_BOUT_STATUSES as readonly string[]).includes(status);
}

/** Voting runs while the event is public and not called off or filed away. */
export const VOTING_OPEN_EVENT_STATUSES = ["PUBLISHED", "LIVE", "INTERMISSION", "FINISHED"] as const;

export function isVotingOpen(eventStatus: string): boolean {
  return (VOTING_OPEN_EVENT_STATUSES as readonly string[]).includes(eventStatus);
}

/** Stable, non-reversible key for "who voted". Accounts and anonymous browsers
 * live in separate namespaces so a guest id can never collide with a user id. */
export function voterKeyFor(input: { userId?: string | null; guestId?: string | null }): string | null {
  if (input.userId) return `u:${input.userId}`;
  if (input.guestId) return `g:${createHash("sha256").update(input.guestId).digest("hex")}`;
  return null;
}

export type VoteTally = { boutId: string; votes: number; share: number; leading: boolean };

/** Counts per bout as shares of the total, with every tied leader flagged. */
export function tallyVotes(boutIds: string[], counts: Map<string, number>): { total: number; rows: VoteTally[] } {
  const total = boutIds.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
  const top = Math.max(0, ...boutIds.map((id) => counts.get(id) ?? 0));
  const rows = boutIds.map((boutId) => {
    const votes = counts.get(boutId) ?? 0;
    return { boutId, votes, share: total === 0 ? 0 : Math.round((votes / total) * 100), leading: top > 0 && votes === top };
  });
  return { total, rows };
}
