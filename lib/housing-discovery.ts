import { discover } from './discovery';

export type DiscoveredHousing = {
  city: string;
  area?: string;
  title: string;
  description: string;
  rent?: number;
  bedrooms?: number;
  property_type?: string;
  furnished?: string;
  amenities: string[];
  source_url: string;
  source_name: string;
  source_only: true;
  last_seen_at: string;
};

export type HousingDiscovery = { listings: DiscoveredHousing[]; warnings: string[] };

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

export function parseHousingResult(
  result: { title: string; url: string; description: string; source: string; content?: string },
  location: string,
  now = new Date(),
): DiscoveredHousing | null {
  const city = clean(location);
  const text = clean(`${result.title}. ${result.content ?? result.description}`);
  if (!city || !/\b(?:rent|rental|for lease|bhk|flat|apartment|house|villa|pg|roommate|room for rent)\b/i.test(text)) return null;
  const rentMatch = /(?:₹|rs\.?|inr\s*)\s*([\d,]{4,})|\b([\d,]{4,})\s*(?:per month|\/\s*month|monthly)\b/i.exec(text);
  const bedroomMatch = /\b([1-5])\s*(?:bhk|bed(?:room)?s?)\b/i.exec(text);
  const areaMatch = /\b(?:in|at|near|located in)\s+([A-Z][A-Za-z .-]{2,40})/i.exec(text);
  const rent = rentMatch ? Number((rentMatch[1] ?? rentMatch[2]).replaceAll(',', '')) : undefined;
  if (rent !== undefined && (rent < 1000 || rent > 1000000)) return null;
  const hostname = new URL(result.url).hostname.toLowerCase();
  const sourceName = hostname === 'facebook.com' || hostname.endsWith('.facebook.com')
    ? 'Facebook public page/group (indexed)'
    : result.source;
  return {
    city,
    ...(areaMatch?.[1] ? { area: clean(areaMatch[1]).replace(/[.,]$/, '') } : {}),
    title: clean(result.title).slice(0, 240),
    description: text.slice(0, 1200),
    ...(rent ? { rent } : {}),
    ...(bedroomMatch?.[1] ? { bedrooms: Number(bedroomMatch[1]) } : {}),
    property_type: /villa/i.test(text) ? 'villa' : /pg|roommate/i.test(text) ? 'pg' : /studio/i.test(text) ? 'studio' : /apartment|flat|bhk/i.test(text) ? 'apartment' : 'house',
    furnished: /semi[- ]?furnished/i.test(text) ? 'semi_furnished' : /fully furnished|furnished/i.test(text) ? 'furnished' : 'any',
    amenities: [],
    source_url: result.url,
    source_name: sourceName,
    source_only: true,
    last_seen_at: now.toISOString(),
  };
}

export async function discoverRentals(location: string, limit = 40): Promise<HousingDiscovery> {
  const city = clean(location);
  const generalQuery = `${city} rental homes apartments flats rooms BHK monthly rent public listings`;
  const facebookQuery = `${city} rental homes rooms apartments BHK public Facebook groups and pages`;
  const searches = await Promise.allSettled([
    discover(generalQuery, 'research', process.env, { limit, detailed: true, filters: { location: city } }),
    discover(facebookQuery, 'research', process.env, { limit: Math.min(limit, 20), detailed: true, filters: { location: city, includeDomains: ['facebook.com'] } }),
  ]);
  const seen = new Set<string>();
  const listings: DiscoveredHousing[] = [];
  const warnings: string[] = [
    'Results combine public indexed web pages with publicly indexed Facebook pages/groups. Private or login-only groups are not scraped.',
    'A public source is not proof that a home is available, affordable, safe, or represented by a licensed broker. Verify before contacting anyone.',
  ];
  for (const result of searches) {
    if (result.status === 'rejected') {
      warnings.push(result.reason instanceof Error ? result.reason.message : 'One public search source was unavailable.');
      continue;
    }
    warnings.push(...result.value.warnings);
    for (const row of result.value.results) {
      if (seen.has(row.url)) continue;
      const listing = parseHousingResult(row, city);
      if (!listing) continue;
      seen.add(row.url);
      listings.push(listing);
    }
  }
  return { listings: listings.slice(0, limit), warnings: [...new Set(warnings)] };
}

export async function discoverAhmedabadRentals(limit = 40) {
  return (await discoverRentals('Ahmedabad', limit)).listings;
}
