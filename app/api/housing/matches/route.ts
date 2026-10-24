import { housingMatchSchema } from '@/lib/validation';
import { admin, checkOrigin, identity, json, response, route, ApiError } from '@/lib/server';
import { matchHousing, type HousingListing, type HousingPreferences } from '@/lib/housing-matching';
import { discoverRentals } from '@/lib/housing-discovery';

export const POST = route(async request => {
  checkOrigin(request);
  const input = await json(request, housingMatchSchema);
  const { user } = await identity();
  const db = admin();
  const prefQuery = db.from('housing_preferences').select('*').eq('user_id', user.id);
  const pref = input.preferenceId
    ? await prefQuery.eq('id', input.preferenceId).single()
    : await prefQuery.order('updated_at', { ascending: false }).limit(1).single();
  if (pref.error || !pref.data) throw new ApiError(404, 'Save housing preferences before matching.');

  const city = String(pref.data.city).trim();
  let { data: listings, error: listingError } = await db.from('housing_listings').select('*').eq('city', city).limit(500);
  if (listingError) throw listingError;

  // Refresh on every search so a city is not limited to its first cached batch.
  // Public indexed Facebook pages/groups are included by the discovery adapter;
  // private or login-only content is intentionally not scraped.
  const discovery = await discoverRentals(city, 40);
  if (discovery.listings.length) {
    const inserted = await db.from('housing_listings').upsert(discovery.listings, { onConflict: 'source_url' });
    if (!inserted.error) {
      const refreshed = await db.from('housing_listings').select('*').eq('city', city).limit(500);
      listings = refreshed.data ?? [];
    }
  }

  const preferences: HousingPreferences = {
    city,
    areas: pref.data.areas,
    minRent: pref.data.min_rent,
    maxRent: pref.data.max_rent,
    bedrooms: pref.data.bedrooms,
    propertyTypes: pref.data.property_types,
    furnished: pref.data.furnished,
    needs: pref.data.needs,
  };
  const matches = matchHousing(preferences, (listings ?? []) as HousingListing[]).slice(0, input.limit);
  const run = await db.from('housing_match_runs').insert({ user_id: user.id, preference_id: pref.data.id }).select('id').single();
  if (run.error) throw run.error;
  if (matches.length) {
    const inserted = await db.from('housing_match_results').insert(matches.map(match => ({ run_id: run.data.id, listing_id: match.listingId, score: match.score, reasons: match.reasons, labels: match.labels })));
    if (inserted.error) throw inserted.error;
  }
  return response({
    runId: run.data.id,
    location: city,
    matches,
    warnings: discovery.warnings,
    listings: (listings ?? []).filter(listing => matches.some(match => match.listingId === listing.id)),
  });
});

export const GET = route(async request => { const { user } = await identity(); const limit = Math.min(50, Math.max(1, Number(new URL(request.url).searchParams.get('limit') ?? 20))); const { data, error } = await admin().from('housing_match_runs').select('id,created_at,housing_match_results(*,housing_listings(*))').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(); if (error) throw new ApiError(404, 'No housing matches yet.'); return response({ run: data, limit }); });
