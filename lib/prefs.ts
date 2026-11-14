import type { EventStatus } from "@prisma/client";

/**
 * Optional discovery preferences, kept in a first-party cookie on the visitor's
 * device. They never hide anything: they only move matching events to the front
 * of a list. No account and no location permission are involved.
 */
export const PREFS_COOKIE = "pugna_prefs";
export const PREF_SPORTS = ["Boxing", "MMA", "Muay Thai", "Kickboxing"] as const;
export const MAX_CITY_LENGTH = 60;

export type Prefs = {
  sports: string[];
  city: string;
  /** The visitor chose "No thanks"; do not show the prompt again. */
  dismissed: boolean;
};

export const EMPTY_PREFS: Prefs = { sports: [], city: "", dismissed: false };

export function cleanCity(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_CITY_LENGTH) : "";
}

export function cleanSports(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return PREF_SPORTS.filter((s) => values.includes(s));
}

/** Parse the cookie value defensively: anything malformed means "no preferences". */
export function parsePrefs(raw: string | undefined | null): Prefs {
  if (!raw) return EMPTY_PREFS;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    return { sports: cleanSports(data.sports), city: cleanCity(data.city), dismissed: data.dismissed === true };
  } catch {
    return EMPTY_PREFS;
  }
}

export const serializePrefs = (prefs: Prefs): string => JSON.stringify(prefs);

export const hasPrefs = (prefs: Prefs): boolean => prefs.sports.length > 0 || prefs.city.length > 0;

type Rankable = { status: EventStatus; date: Date; sport: string; city: string | null };

/** 0 = no match; a city match counts for more than a sport match. */
export function prefScore(event: Pick<Rankable, "sport" | "city">, prefs: Prefs): number {
  let score = 0;
  if (prefs.city && event.city && event.city.toLowerCase().includes(prefs.city.toLowerCase())) score += 2;
  if (prefs.sports.some((s) => s.toLowerCase() === event.sport.toLowerCase())) score += 1;
  return score;
}

/**
 * Live-now events stay first. Within live and within upcoming, events matching
 * the visitor's picks come before the rest, then soonest first. With no
 * preferences this is exactly the plain live-first, soonest-first order.
 */
export function personalize<E extends Rankable>(events: E[], prefs: Prefs): E[] {
  const rank = (e: E) => (e.status === "LIVE" || e.status === "INTERMISSION" ? 0 : 1);
  return [...events].sort(
    (a, b) => rank(a) - rank(b) || prefScore(b, prefs) - prefScore(a, prefs) || a.date.getTime() - b.date.getTime(),
  );
}
