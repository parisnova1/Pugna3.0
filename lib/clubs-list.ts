/**
 * How the clubs directory is laid out. Featured is a curated shelf shown only on
 * the unfiltered directory; the list below it never repeats a featured club.
 * Once someone searches or filters, that is one list of matches and nothing is
 * featured, so no club can appear twice on the page.
 */
export function arrangeClubs<T extends { id: string }>(
  featured: T[],
  all: T[],
  isFiltered: boolean,
): { featured: T[]; rest: T[] } {
  if (isFiltered) return { featured: [], rest: all };
  const featuredIds = new Set(featured.map((c) => c.id));
  return { featured, rest: all.filter((c) => !featuredIds.has(c.id)) };
}
