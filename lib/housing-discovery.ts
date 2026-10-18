import { discover } from './discovery';

export type DiscoveredHousing = {
  city: 'Ahmedabad'; area?: string; title: string; description: string; rent?: number; bedrooms?: number;
  property_type?: string; furnished?: string; amenities: string[]; source_url: string; source_name: string; source_only: true; last_seen_at: string;
};

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
export function parseHousingResult(result: { title: string; url: string; description: string; source: string; content?: string }, now = new Date()): DiscoveredHousing | null {
  const text = clean(`${result.title}. ${result.content ?? result.description}`);
  if (!/\b(?:rent|rental|for lease|bhk|flat|apartment|house|villa|pg)\b/i.test(text)) return null;
  const rentMatch = /(?:₹|rs\.?|inr\s*)\s*([\d,]{4,})|\b([\d,]{4,})\s*(?:per month|\/\s*month|monthly)\b/i.exec(text);
  const bedroomMatch = /\b([1-5])\s*(?:bhk|bed(?:room)?s?)\b/i.exec(text);
  const areaMatch = /\b(?:in|at|near|located in)\s+([A-Z][A-Za-z .-]{2,40})/i.exec(text);
  const rent = rentMatch ? Number((rentMatch[1] ?? rentMatch[2]).replaceAll(',', '')) : undefined;
  if (rent !== undefined && (rent < 3000 || rent > 1000000)) return null;
  return { city: 'Ahmedabad', ...(areaMatch?.[1] ? { area: clean(areaMatch[1]).replace(/[.,]$/, '') } : {}), title: clean(result.title).slice(0, 240), description: text.slice(0, 1200), ...(rent ? { rent } : {}), ...(bedroomMatch?.[1] ? { bedrooms: Number(bedroomMatch[1]) } : {}), property_type: /villa/i.test(text) ? 'villa' : /apartment|flat|bhk/i.test(text) ? 'apartment' : 'house', furnished: /semi[- ]?furnished/i.test(text) ? 'semi_furnished' : /fully furnished|furnished/i.test(text) ? 'furnished' : 'any', amenities: [], source_url: result.url, source_name: result.source, source_only: true, last_seen_at: now.toISOString() };
}

export async function discoverAhmedabadRentals(limit = 40) {
  const found = await discover('Ahmedabad rental homes apartments flats BHK monthly rent public listing', 'research', process.env, { limit, detailed: true, filters: { location: 'Ahmedabad', country: 'IN' } });
  const seen = new Set<string>();
  return found.results.map(result => parseHousingResult(result)).filter((item): item is DiscoveredHousing => !!item).filter(item => { if (seen.has(item.source_url)) return false; seen.add(item.source_url); return true; });
}
