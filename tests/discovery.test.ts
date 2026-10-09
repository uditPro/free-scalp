import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discover, discoveryProvider, discoveryQuery, DiscoveryError, parseMcpResults } from '../lib/discovery';
import { authorizeSearch, providerFilters, searchFiltersSchema } from '../lib/search-options';
import { serviceStatus } from '../lib/config';

const record = (url = 'https://example.com/jobs/1', title = 'Frontend developer', text = 'An original posting excerpt.') => `Title: ${title}\nURL: ${url}\nPublished: N/A\nAuthor: N/A\nHighlights:\n${text}`;
const response = (text: string) => ({ content: [{ type: 'text', text }] });

test('search selects keyless MCP when no paid key is configured', () => {
  assert.equal(discoveryProvider({}), 'exa-mcp');
  assert.equal(discoveryProvider({ EXA_API_KEY: 'test-key' }), 'exa-api');
  assert.equal(discoveryProvider({ EXA_API_KEY: 'test-key', SEARCH_PROVIDER: 'exa-mcp' }), 'exa-mcp');
  assert.throws(() => discoveryProvider({ SEARCH_PROVIDER: 'exa-api' }), /API key/);
  assert.throws(() => discoveryProvider({ SEARCH_PROVIDER: 'arbitrary-command' }), /invalid/);
});

test('MCP configuration still requires auth and a server-only persistence key', () => {
  const env = { APP_URL: 'http://localhost:3000', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'test-public', SEARCH_PROVIDER: 'exa-mcp' };
  assert.equal(serviceStatus(env).search, false);
  assert.equal(serviceStatus({ ...env, SUPABASE_SECRET_KEY: 'test-server' }).search, true);
  assert.equal(serviceStatus({ ...env, SUPABASE_SECRET_KEY: 'test-server', SEARCH_PROVIDER: 'unknown' }).search, false);
});

test('client searches target prospective buyers, not businesses selling the same service', () => {
  const input = discoveryQuery('web design', 'clients');
  assert.match(input.query, /requests to hire/);
  assert.match(input.objective, /prospective buyers/);
  assert.match(discoveryQuery('React', 'jobs').objective, /Do not invent/);
});

test('Exa MCP text records normalize to the shared source-linked result contract', () => {
  const results = parseMcpResults(response(record() + '\n\n---\n\n' + record('https://example.org/role', 'Designer', 'Design systems.')));
  assert.equal(results.length, 2);
  assert.deepEqual(results[0], { id: '1', title: 'Frontend developer', url: 'https://example.com/jobs/1', description: 'An original posting excerpt.', source: 'example.com' });
});

test('normalization bounds text/results and rejects unsafe or duplicate source URLs', () => {
  const text = [record(), record(), record('https://127.0.0.1/admin'), record('http://example.com/insecure'), ...Array.from({ length: 20 }, (_, index) => record(`https://example.com/${index}`, 'T'.repeat(400), 'x'.repeat(2000)))].join('\n---\n');
  const results = parseMcpResults(response(text));
  assert.equal(results.length, 10); assert.equal(new Set(results.map(row => row.url)).size, 10);
  assert.ok(results.every(row => row.title.length <= 300 && row.description.length <= 1200));
  assert.ok(results.every(row => !row.url.includes('127.0.0.1')));
});

test('only provider records are results, not links mentioned within an excerpt', () => {
  const results = parseMcpResults(response(record(undefined, undefined, 'See https://elsewhere.example/path for context.')));
  assert.equal(results.length, 1);
});

test('explicit zero results differ from malformed provider responses', () => {
  assert.deepEqual(parseMcpResults(response('No results found.')), []);
  for (const bad of [null, {}, { content: [] }, response('Unexpected server response'), response('x'.repeat(250001))]) assert.throws(() => parseMcpResults(bad), DiscoveryError);
});

test('MCP rate limits produce safe actionable errors, not raw provider payloads', () => {
  assert.throws(() => parseMcpResults({ ...response('Rate limit exceeded; private detail'), isError: true }), (error: unknown) => error instanceof DiscoveryError && error.status === 429 && !error.message.includes('private detail'));
});

test('structured MCP results use the same sanitization', () => {
  const results = parseMcpResults({ structuredContent: { results: [{ url: 'https://example.com', title: 'Source', text: 'Excerpt' }, { url: 'javascript:bad' }] } });
  assert.equal(results.length, 1); assert.equal(results[0].description, 'Excerpt');
});

test('advanced JSON MCP results preserve paid source metadata and expanded excerpts', () => {
  const results = parseMcpResults({ content: [{ type: 'text', text: JSON.stringify({ results: [{ url: 'https://reddit.com/r/jobs/1', title: 'Hiring', text: 'Long source detail', publishedDate: '2026-01-02T00:00:00Z', author: 'u/example' }] }) }] }, { limit: 50, detailed: true });
  assert.equal(results[0].publishedAt, '2026-01-02T00:00:00.000Z'); assert.equal(results[0].author, 'u/example'); assert.equal(results[0].content, 'Long source detail');
});

test('paid plans authorize 50/100 results and advanced filters while free stays bounded', () => {
  assert.equal(authorizeSearch('free', {}).limit, 10);
  assert.equal(authorizeSearch('starter', { limit: 50, filters: { country: 'IN', sources: ['reddit'] } }).detailed, true);
  assert.equal(authorizeSearch('pro', { limit: 100 }).limit, 100);
  assert.throws(() => authorizeSearch('free', { limit: 11 }), /allows up to 10/);
  assert.throws(() => authorizeSearch('free', { filters: { country: 'US' } }), /require/);
  assert.throws(() => searchFiltersSchema.parse({ includeDomains: ['https://reddit.com'] }), /public hostnames/);
});

test('provider filters combine sources and explicit domains while blocks remain separate', () => {
  const filters = searchFiltersSchema.parse({ sources: ['reddit', 'linkedin'], includeDomains: ['github.com'], excludeDomains: ['spam.com'], publishedAfter: '2026-01-01T00:00:00Z', country: 'US' });
  const body = providerFilters(filters);
  assert.deepEqual(body.includeDomains, ['github.com', 'reddit.com', 'linkedin.com']);
  assert.deepEqual(body.excludeDomains, ['spam.com']); assert.equal(body.startPublishedDate, '2026-01-01T00:00:00Z'); assert.equal(body.userLocation, 'US');
});

test('dedicated Exa API still works and does not expose the key in the result', async t => {
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, 'https://api.exa.ai/search');
    assert.equal((options.headers as Record<string, string>)['x-api-key'], 'test-private-key');
    assert.equal(options.redirect, 'error');
    return Response.json({ results: [{ url: 'https://example.com/jobs', title: 'Jobs', text: 'Real provider fixture' }] });
  });
  const result = await discover('React', 'jobs', { EXA_API_KEY: 'test-private-key' });
  assert.equal(result.provider, 'exa-api'); assert.equal(result.results.length, 1);
  assert.equal(JSON.stringify(result).includes('test-private-key'), false);
});
