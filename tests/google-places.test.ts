import assert from 'node:assert/strict';
import test from 'node:test';
import { googlePlacesSearch } from '../lib/google-places';

test('Places adapter does nothing without a server-side authorized key', async () => {
  assert.deepEqual(await googlePlacesSearch('web design Mumbai', {}, {}), { results: [] });
});

test('Places adapter uses official endpoint and requested field mask', async t => {
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, 'https://places.googleapis.com/v1/places:searchText');
    assert.equal(options.redirect, 'error');
    const headers = options.headers as Record<string, string>;
    assert.equal(headers['X-Goog-Api-Key'], 'authorized-test-key');
    assert.match(headers['X-Goog-FieldMask'], /places\.googleMapsUri/);
    assert.equal(JSON.parse(String(options.body)).textQuery, 'web design Mumbai');
    return Response.json({ places: [{ id: 'p1', displayName: { text: 'Acme' }, formattedAddress: 'Mumbai', googleMapsUri: 'https://maps.google.com/?cid=1', businessStatus: 'OPERATIONAL' }] });
  });
  const result = await googlePlacesSearch('web design Mumbai', {}, { GOOGLE_PLACES_API_KEY: 'authorized-test-key' });
  assert.equal(result.results[0].source, 'google-places');
  assert.equal(result.results[0].title, 'Acme');
  assert.equal(result.results[0].description, 'Mumbai · OPERATIONAL');
});
