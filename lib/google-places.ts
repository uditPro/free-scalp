import type { SearchResult } from './validation';

type Environment = Record<string, string | undefined>;

export type PlacesProviderResult = { results: SearchResult[]; warning?: string };

/**
 * Uses the official Google Places API only. This deliberately does not fetch
 * Maps pages, parse HTML, or accept an API key from a browser request.
 */
export async function googlePlacesSearch(
  query: string,
  options: { limit?: number; country?: string } = {},
  env: Environment = process.env,
): Promise<PlacesProviderResult> {
  const key = env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) return { results: [] };

  const limit = Math.min(20, Math.max(1, Math.floor(options.limit ?? 10)));
  const body = {
    textQuery: query,
    pageSize: limit,
    languageCode: 'en',
    ...(options.country ? { regionCode: options.country.toUpperCase() } : {}),
  };
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.primaryType,places.businessStatus',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (response.status === 429) throw new Error('The Google Places API quota was reached.');
  if (!response.ok) throw new Error('The authorized Google Places request could not be completed.');
  const payload = await response.json() as { places?: unknown[] };
  if (!Array.isArray(payload.places)) return { results: [] };

  const results: SearchResult[] = [];
  for (const item of payload.places) {
    if (!item || typeof item !== 'object') continue;
    const place = item as Record<string, unknown>;
    const displayName = place.displayName && typeof place.displayName === 'object'
      ? (place.displayName as { text?: unknown }).text
      : undefined;
    const name = typeof displayName === 'string' ? displayName.trim() : '';
    const mapsUrl = typeof place.googleMapsUri === 'string' ? place.googleMapsUri : '';
    if (!name || !/^https:\/\//.test(mapsUrl)) continue;
    const address = typeof place.formattedAddress === 'string' ? place.formattedAddress : '';
    const phone = typeof place.nationalPhoneNumber === 'string' ? place.nationalPhoneNumber : '';
    const type = typeof place.primaryType === 'string' ? place.primaryType.replaceAll('_', ' ') : '';
    const status = typeof place.businessStatus === 'string' ? place.businessStatus : '';
    results.push({
      id: typeof place.id === 'string' ? place.id : String(results.length + 1),
      title: name.slice(0, 300),
      url: mapsUrl,
      description: [address, type, status].filter(Boolean).join(' · ').slice(0, 1200),
      content: [name, address, phone, type, status].filter(Boolean).join('. ').slice(0, 6000),
      source: 'google-places',
    });
  }
  return { results, warning: 'Google Places data was retrieved through the official API key configured by this workspace; no Maps pages were scraped.' };
}
