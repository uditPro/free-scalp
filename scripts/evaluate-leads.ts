import { corroborateLeadResults, normalizeLeads } from '../lib/lead-workflow';
import type { SearchResult } from '../lib/validation';

// Small deterministic regression harness. Replace fixtures with reviewed,
// permission-safe public examples when measuring a provider change.
const cases: Array<{ name: string; input: Parameters<typeof normalizeLeads>[1]; expected: number; rows: SearchResult[] }> = [
  { name: 'keeps buyer signal', input: { niche: 'web design', location: 'Mumbai', need: 'new website' }, expected: 1, rows: [{ id: '1', title: 'Example Web Studio', url: 'https://example.com/contact', description: 'Example Web Studio is a web design agency in Mumbai. We need a new website.', source: 'fixture' }] },
  { name: 'rejects editorial noise', input: { niche: 'web design' }, expected: 0, rows: [{ id: '1', title: 'Top 5 sites to hire freelancers', url: 'https://example.com/blog/list', description: 'A guide to marketplaces.', source: 'fixture' }] },
];
let passed = 0;
for (const item of cases) {
  const actual = normalizeLeads(corroborateLeadResults(item.rows, []), item.input).length;
  if (actual !== item.expected) throw new Error(`${item.name}: expected ${item.expected}, got ${actual}`);
  passed++;
}
console.log(`Lead evaluation passed: ${passed}/${cases.length} cases`);
