import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalLeadKey, corroborateLeadResults, leadSearchQuery, leadsCsv, normalizeLeads, scoreLead } from '../lib/lead-workflow';
import { leadPatchSchema, leadSearchSchema } from '../lib/validation';

test('lead search query keeps source labels in Exa query without direct fetching', () => {
  const query = leadSearchQuery({ niche: 'web design', location: 'Mumbai', sources: ['Justdial', 'IndiaMART'] });
  assert.match(query, /Exa-indexed source label: Justdial/);
  assert.match(query, /Exa-indexed source label: IndiaMART/);
});

test('lead normalization is public-business-only and deduplicates canonical keys', () => {
  const results = normalizeLeads([
    { id: '1', title: 'Acme Web Design | Justdial', url: 'https://www.acme.example/contact', description: 'Acme Web Design is a web design agency in Mumbai. We need web design support. Public contact hello@acme.example +91 98765 43210.', source: 'example' },
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

test('lead extraction rejects generic marketplace and keeps concise evidence', () => {
  const results = normalizeLeads([
    { id: 'junk', title: 'Top 5 sites to hire freelancers', url: 'https://example.com/freelancers', description: 'A generic marketplace list of sites to hire freelancers.', source: 'example' },
    { id: 'good', title: 'Elemech Engineering | Contact', url: 'https://elemech.example/contact', description: 'Elemech Engineering is a manufacturer and supplier based in Pune. Contact us at sales@elemech.example or +91 98765 43210. We need a new website.', source: 'example' },
  ], { niche: 'engineering', location: 'Pune', need: 'new website' });
  const good = results.find(result => result.sourceDomain === 'elemech.example');
  assert.equal(results.some(result => /freelancers/i.test(result.sourceTitle ?? '')), false);
  assert.ok(good);
  if (!good) return;
  assert.equal(good.businessName, 'Elemech Engineering');
  assert.equal(good.sourceDomain, 'elemech.example');
  assert.equal(good.publicContacts.emails?.[0], 'sales@elemech.example');
  assert.equal(good.publicContacts.phones?.[0], '+91 9876543210');
  assert.ok(good.qualityScore! >= 50);
  assert.ok(good.description.length <= 600);
  assert.ok(good.evidence!.location);
  assert.ok(good.confidence!.contacts > 0);
});

test('lead extraction rejects editorial, tender, directory, and date-like phone values', () => {
  const results = normalizeLeads([
    { id: 'article', title: 'Best websites to hire independent contractors in 2026', url: 'https://example.com/blog/hiring', description: 'A guide for businesses looking for independent contractors.', source: 'example' },
    { id: 'tender', title: 'Tender for electrical cable laying RefID: 149924788', url: 'https://tenders.example/tender/149924788', description: 'Tenders are invited for electrical work. Contact 04-06-2025.', source: 'example' },
    { id: 'directory', title: 'Licensed Electrical Contractors Manufacturers Directory', url: 'https://directory.example/listing', description: 'Search results and all listings for electrical suppliers.', source: 'example' },
  ], { niche: 'electrical', location: 'Ahmedabad', need: 'website' });
  assert.equal(results.length, 0);
});

test('lead CSV includes complete fields and safely serializes structured values', () => {
  const csv = leadsCsv([{ id: '1', business_name: '=bad', public_contacts: { emails: ['a@example.com'], phones: ['+91 9876543210'] }, evidence: { needSignal: 'We need a website' }, quality_score: 88, status: 'new' }]);
  assert.match(csv, /email_addresses/);
  assert.match(csv, /a@example\.com/);
  assert.match(csv, /\"'=bad\"/);
  assert.match(csv, /needSignal/);
  assert.match(csv, /provenance/);
});

test('entity resolution merges corroborated public sources and preserves provenance', () => {
  const primary = [{ id: '1', title: 'Acme Web Design', url: 'https://acme.example/contact', description: 'Acme Web Design is an agency based in Mumbai. We need a new website.', source: 'example', provider: 'exa-api' as const }];
  const places = [{ id: 'p1', title: 'Acme Web Design', url: 'https://maps.google.com/?cid=1', description: 'Mumbai · web design agency', content: 'Acme Web Design. Mumbai. +91 98765 43210.', source: 'google-places', provider: 'google-places' as const }];
  const leads = normalizeLeads(corroborateLeadResults(primary, places), { niche: 'web design', location: 'Mumbai', need: 'new website' });
  assert.equal(leads.length, 1);
  assert.equal(leads[0].provenance?.length, 2);
  assert.equal(leads[0].provenance?.[1].role, 'corroboration');
  assert.equal(leads[0].evidence?.corroboratingSource, undefined);
});
