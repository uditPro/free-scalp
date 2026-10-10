import assert from 'node:assert/strict';
import { authSchema, checkoutSchema, searchSchema, safeUrl, normalizeResults, quotaLimit, hasQuota } from '../lib/validation';
import { parseMcpResults } from '../lib/discovery';

assert.deepEqual(searchSchema.parse({ query: '  solar jobs  ', kind: 'jobs' }), { query: 'solar jobs', kind: 'jobs' });
for (const value of [{ query: 'x', kind: 'jobs' }, { query: 'abc', kind: 'shell' }, { query: 'x'.repeat(501), kind: 'research' }, { query: 'abc', kind: 'clients', plan: 'pro' }]) assert.equal(searchSchema.safeParse(value).success, false);
assert.equal(checkoutSchema.safeParse({ plan: 'enterprise' }).success, false);
assert.equal(authSchema.safeParse({ action: 'login', email: 'bad', password: 'short' }).success, false);
assert.equal(authSchema.safeParse({ action: 'update-password', password: 'long-password' }).success, true);
for (const url of ['http://example.com', 'javascript:alert(1)', 'https://user:pass@example.com', 'https://127.0.0.1', 'https://2130706433', 'https://[::1]', 'https://localhost', 'https://host.local', 'https://example.com:8080', null]) assert.equal(safeUrl(url), null);
assert.equal(safeUrl('https://example.com/jobs?q=engineer'), 'https://example.com/jobs?q=engineer');
assert.equal(quotaLimit('free'), 10); assert.equal(quotaLimit('starter'), 100); assert.equal(quotaLimit('pro'), 500); assert.equal(quotaLimit('invented'), 10);
assert.equal(quotaLimit('__proto__'), 10); assert.equal(quotaLimit('constructor'), 10);
assert.equal(hasQuota('free', 9), true); assert.equal(hasQuota('free', 10), false); assert.equal(hasQuota('pro', 500), false); assert.equal(hasQuota('free', -1), false); assert.equal(hasQuota('free', NaN), false); assert.equal(hasQuota('free', 0.5), false);
const rows = Array.from({ length: 25 }, (_, i) => ({ url: `https://example.com/${i}`, title: 'a'.repeat(400), text: 'b'.repeat(1500) }));
const results = normalizeResults({ results: [{ url: 'javascript:bad' }, rows[0], ...rows] });
assert.equal(results.length, 10); assert.equal(results[0].title.length, 300); assert.equal(results[0].description.length, 1200); assert.equal(new Set(results.map(x => x.url)).size, 10); assert.equal(results[0].source, 'example.com');
const ordered = normalizeResults({ results: [
  { url: 'https://example.com/undated', title: 'Undated' },
  { url: 'https://example.com/old', title: 'Old', publishedDate: '2025-01-01T00:00:00Z' },
  { url: 'https://example.com/new', title: 'New', publishedDate: '2026-01-01T00:00:00Z' },
] }, { limit: 3 });
assert.deepEqual(ordered.map(row => row.title), ['New', 'Old', 'Undated']);
assert.deepEqual(normalizeResults(null), []); assert.deepEqual(normalizeResults({ results: [null, {}, 4] }), []);

const mcpJsonArray = JSON.stringify([{ title: 'Example role', url: 'https://jobs.example.com/role/1', highlights: ['Remote role'] }]);
assert.equal(parseMcpResults({ content: [{ type: 'text', text: mcpJsonArray }] })[0]?.title, 'Example role');
assert.equal(parseMcpResults({ content: [{ type: 'text', text: '- [Example project](https://example.com/project) - public brief' }] })[0]?.url, 'https://example.com/project');
console.log('Validation, quota boundaries, and result URL tests passed.');
