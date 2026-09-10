/**
 * Free, no-API-key geocoding via OpenStreetMap Nominatim. Never throws — a
 * flaky network call or a bad address must never block the publish/create
 * action that triggered it; the row just ends up without a map pin.
 *
 * Tries `venue city` first, then falls back to just `city` — venue names are
 * often invented/informal ("Bayview Arena") and don't resolve on their own,
 * but the city almost always does.
 */
export async function geocodeVenue(venue: string | null, city: string | null): Promise<{ lat: number; lng: number } | null> {
  const full = [venue, city].filter(Boolean).join(" ");
  return (await geocodeAddress(full)) ?? (city ? await geocodeAddress(city) : null);
}

export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Pugna Combat Sports App (https://pugna3-0.vercel.app)" },
    });
    if (!res.ok) return null;

    const results = (await res.json()) as { lat: string; lon: string }[];
    const first = results[0];
    if (!first) return null;

    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}
