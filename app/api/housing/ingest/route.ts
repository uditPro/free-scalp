import { admin, checkOrigin, identity, response, route, ApiError } from '@/lib/server';
import { discoverAhmedabadRentals } from '@/lib/housing-discovery';

export const POST = route(async request => {
  checkOrigin(request);
  await identity();
  try {
    const listings = await discoverAhmedabadRentals();
    if (listings.length) {
      const { error } = await admin().from('housing_listings').upsert(listings, { onConflict: 'source_url' });
      if (error) throw error;
    }
    return response({ count: listings.length, warnings: ['Public-web housing listings are source-only. Confirm availability, rent, ownership, and terms directly.'] });
  } catch (error) {
    throw new ApiError(error instanceof Error && 'status' in error ? Number((error as { status?: number }).status) : 502, 'Housing sources could not be refreshed. Try again later.');
  }
});
