/**
 * Sparring matchmaking — a simple compatibility score, not a solver. Ranks
 * every possible pair by weight-group/sex/experience/age fit and lets the
 * host pick from the top of the list or override entirely. No bipartite
 * matching algorithm — deliberately simple per the product brief.
 */
export type MatchCandidate = {
  participantId: string;
  fighterId: string;
  displayName: string;
  clubName: string | null;
  weightGroupLabel: string | null;
  sex: string | null;
  experienceLevel: string | null;
  age: number | null;
};

export type SuggestedPair = {
  a: MatchCandidate;
  b: MatchCandidate;
  score: number;
};

function compatibilityScore(a: MatchCandidate, b: MatchCandidate): number {
  let score = 100;
  if (a.weightGroupLabel && b.weightGroupLabel && a.weightGroupLabel !== b.weightGroupLabel) score -= 40;
  if (a.sex && b.sex && a.sex !== b.sex) score -= 30;
  if (a.experienceLevel && b.experienceLevel && a.experienceLevel !== b.experienceLevel) score -= 20;
  if (a.age != null && b.age != null) score -= Math.min(20, Math.abs(a.age - b.age));
  return Math.max(0, score);
}

export function suggestMatches(candidates: MatchCandidate[]): SuggestedPair[] {
  const pairs: SuggestedPair[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]!;
      const b = candidates[j]!;
      pairs.push({ a, b, score: compatibilityScore(a, b) });
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

export function ageFromDob(dateOfBirth: Date | null, now: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const beforeBirthday =
    now.getMonth() < dateOfBirth.getMonth() ||
    (now.getMonth() === dateOfBirth.getMonth() && now.getDate() < dateOfBirth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}
