import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalLeadKey, leadSearchQuery, normalizeLeads, scoreLead } from '../lib/lead-workflow';
import { leadPatchSchema, leadSearchSchema } from '../lib/validation';

test('lead search query keeps source labels in Exa query without direct fetching', () => {
  const query = leadSearchQuery({ niche: 'web design', location: 'Mumbai', sources: ['Justdial', 'IndiaMART'] });
  assert.match(query, /Exa-indexed source label: Justdial/);
  assert.match(query, /Exa-indexed source label: IndiaMART/);
});

test('lead normalization is public-business-only and deduplicates canonical keys', () => {
  const results = normalizeLeads([
    { id: '1', title: 'Acme Web Design | Justdial', url: 'https://www.acme.example/contact', description: 'Acme Web Design in Mumbai. Public contact hello@acme.example +91 98765 43210.', source: 'example' },
    { id: '2', title: 'Acme Web Design', url: 'https://acme.example/about', description: 'A duplicate business page.', source: 'example' },
  ], { niche: 'web design', location: 'Mumbai' });
  assert.equal(results.length, 1);
  assert.equal(results[0].domain, 'acme.example');
  assert.deepEqual(results[0].publicContacts.emails, ['hello@acme.example']);
  assert.equal(results[0].publicContacts.phones?.length, 1);
  assert.equal(canonicalLeadKey(results[0]), results[0].canonicalKey);
});

test('lead scoring is deterministic and explainable', () => {
  const lead = { businessName: 'Acme', domain: 'acme.example', sourceUrl: 'https://acme.example', description: 'Web design agency needs web design support in Mumbai.', location: 'Mumbai', publicContacts: { emails: ['hello@acme.example'], website: 'https://acme.example' } };
  const first = scoreLead(lead, { niche: 'web design', location: 'Mumbai', need: 'web design', contactPreference: 'email' });
  assert.deepEqual(first, scoreLead(lead, { niche: 'web design', location: 'Mumbai', need: 'web design', contactPreference: 'email' }));
  assert.equal(first.explanation.method.includes('no inferred'), true);
});

test('lead schemas bound input and status values', () => {
  assert.equal(leadSearchSchema.safeParse({ niche: 'web design', unexpected: true }).success, false);
  assert.equal(leadPatchSchema.safeParse({ status: 'qualified' }).success, true);
  assert.equal(leadPatchSchema.safeParse({ status: 'invalid' }).success, false);
});
