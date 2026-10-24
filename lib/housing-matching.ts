export type HousingPreferences = { city: string; areas?: string[]; minRent?: number; maxRent?: number; bedrooms?: number; propertyTypes?: string[]; furnished?: string; needs?: string[] };
export type HousingListing = { id: string; city: string; area?: string | null; rent?: number | null; bedrooms?: number | null; property_type?: string | null; furnished?: string | null; amenities?: string[] | null; source_url: string; source_name: string; last_seen_at: string; source_only?: boolean; };
export type HousingMatch = { listingId: string; score: number; reasons: string[]; labels: string[]; stale: boolean; sourceOnly: boolean };

const norm = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
export function matchHousing(preferences: HousingPreferences, listings: HousingListing[], now = new Date()): HousingMatch[] {
  return listings.filter(listing => {
    if (norm(listing.city) !== norm(preferences.city)) return false;
    if (listing.rent != null && preferences.minRent != null && listing.rent < preferences.minRent) return false;
    if (listing.rent != null && preferences.maxRent != null && listing.rent > preferences.maxRent) return false;
    if (listing.bedrooms != null && preferences.bedrooms != null && listing.bedrooms < preferences.bedrooms) return false;
    if (listing.property_type && preferences.propertyTypes?.length && !preferences.propertyTypes.includes(norm(listing.property_type))) return false;
    return true;
  }).map(listing => {
    let score = 0; const reasons: string[] = [];
    const area = norm(listing.area); const wantedAreas = (preferences.areas ?? []).map(norm);
    if (!wantedAreas.length || wantedAreas.some(wanted => area === wanted || area.includes(wanted) || wanted.includes(area))) { score += 25; reasons.push(`Area matches your ${preferences.city} preference`); }
    if (preferences.maxRent === undefined || listing.rent == null || listing.rent <= preferences.maxRent) { score += 25; reasons.push('Rent is within your maximum'); }
    if (preferences.minRent === undefined || listing.rent == null || listing.rent >= preferences.minRent) score += 5;
    if (preferences.bedrooms === undefined || listing.bedrooms == null || listing.bedrooms >= preferences.bedrooms) { score += 20; reasons.push('Bedroom count meets your preference'); }
    if (!preferences.propertyTypes?.length || (listing.property_type && preferences.propertyTypes.includes(norm(listing.property_type)))) { score += 15; reasons.push('Property type matches'); }
    if (!preferences.furnished || preferences.furnished === 'any' || norm(listing.furnished) === norm(preferences.furnished)) { score += 10; reasons.push('Furnishing preference matches'); }
    const stale = !Number.isFinite(Date.parse(listing.last_seen_at)) || now.getTime() - Date.parse(listing.last_seen_at) > 7 * 86400000;
    const sourceOnly = listing.source_only !== false; const labels = [...(sourceOnly ? ['source-only'] : []), ...(stale ? ['stale'] : [])];
    if (stale) reasons.push('Listing has not been refreshed recently; verify availability');
    if (sourceOnly) reasons.push('Public-web source only; availability is not verified');
    return { listingId: listing.id, score, reasons, labels, stale, sourceOnly };
  }).sort((a, b) => b.score - a.score || a.listingId.localeCompare(b.listingId));
}
