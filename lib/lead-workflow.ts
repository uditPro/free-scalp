import type { SearchResult } from './validation';

export const LEAD_STATUSES = ['new', 'qualified', 'contacted', 'in_conversation', 'won', 'not_fit', 'snoozed'] as const;
export type LeadStatus = typeof LEAD_STATUSES[number];
export type LeadSearchInput = { niche: string; location?: string; country?: string; businessType?: string; need?: string; sources?: string[]; contactPreference?: 'any' | 'email' | 'phone' | 'website'; limit?: number };
export type LeadRecord = { businessName: string; domain: string; sourceUrl: string; description: string; location?: string; contactName?: string; industry?: string; needSignal?: string; publicContacts: { emails?: string[]; phones?: string[]; website?: string } };

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const tokens = (value: string) => new Set((value.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]{1,}/g) ?? []).filter(word => word.length > 2));
const overlap = (a: string, b: string) => { const left = tokens(a); const right = tokens(b); return left.size ? [...left].filter(word => right.has(word)).length / left.size : 0; };

export function leadSearchQuery(input: LeadSearchInput) {
  const parts = [input.niche, input.businessType, input.need, input.location, input.country].filter(Boolean);
  const sourceLabels = (input.sources ?? []).map(source => `Exa-indexed source label: ${source}`).join('; ');
  return `${parts.join(' ')}${sourceLabels ? ` ${sourceLabels}` : ''}. Identify public businesses with a relevant need; return original source pages only. ${input.contactPreference && input.contactPreference !== 'any' ? `Prefer pages with an explicitly published public ${input.contactPreference} contact.` : ''}`.trim();
}

function publicContacts(text: string, sourceUrl: string) {
  const emails = [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])].map(value => value.toLowerCase()).slice(0, 5);
  const phones = [...new Set(text.match(/(?:\+?\d[\d .()\-]{7,}\d)/g) ?? [])].map(value => clean(value)).slice(0, 5);
  let website: string | undefined;
  try { website = new URL(sourceUrl).origin; } catch { /* normalized discovery URLs are safe */ }
  return { ...(emails.length ? { emails } : {}), ...(phones.length ? { phones } : {}), ...(website ? { website } : {}) };
}

export function canonicalLeadKey(lead: LeadRecord) { return `${lead.domain.toLowerCase()}::${clean(lead.businessName).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.slice(0, 500); }

export function normalizeLeadResult(result: SearchResult): LeadRecord | null {
  let url: URL; try { url = new URL(result.url); } catch { return null; }
  const domain = url.hostname.toLowerCase().replace(/^www\./, '');
  const businessName = clean(result.title).replace(/\s*[|–—-]\s*(?:justdial|indiamart|linkedin|reddit|exa).*$/i, '').slice(0, 240) || domain;
  const description = clean(result.content ?? result.description).slice(0, 3000);
  const locationMatch = /\b(?:located|based|location|serving|in)\s*(?:in|at|:)?\s*([A-Z][A-Za-z .,'-]{2,80})/i.exec(description);
  const contactMatch = /(?:contact|speak with|ask for)\s+([A-Z][A-Za-z.'-]{2,40}(?:\s+[A-Z][A-Za-z.'-]{2,40})?)/i.exec(description);
  const industryMatch = /\b(?:specialist|provider|company|agency|firm|clinic|studio|store|shop)\s+(?:in|for)\s+([A-Za-z][A-Za-z &/-]{2,80})/i.exec(description);
  const needMatch = /\b(?:looking for|need(?:s)?|seeking|request(?:s|ed)?|want(?:s)?|problem)\s+([^.!?]{8,180})/i.exec(description);
  return { businessName, domain, sourceUrl: url.toString(), description, ...(locationMatch?.[1] ? { location: clean(locationMatch[1]).replace(/[.,]$/, '') } : {}), ...(contactMatch?.[1] ? { contactName: clean(contactMatch[1]).slice(0, 100) } : {}), ...(industryMatch?.[1] ? { industry: clean(industryMatch[1]).slice(0, 120) } : {}), ...(needMatch?.[1] ? { needSignal: clean(needMatch[1]).slice(0, 220) } : {}), publicContacts: publicContacts(description, url.toString()) };
}

export function scoreLead(lead: LeadRecord, input: LeadSearchInput) {
  const haystack = `${lead.businessName} ${lead.description} ${lead.location ?? ''}`;
  const components = { niche: Math.round(overlap(input.niche, haystack) * 100), businessType: input.businessType ? Math.round(overlap(input.businessType, haystack) * 100) : 50, need: input.need ? Math.round(overlap(input.need, haystack) * 100) : 50, location: input.location ? (haystack.toLowerCase().includes(input.location.toLowerCase()) ? 100 : 0) : 50, contact: input.contactPreference === 'email' ? (lead.publicContacts.emails?.length ? 100 : 0) : input.contactPreference === 'phone' ? (lead.publicContacts.phones?.length ? 100 : 0) : input.contactPreference === 'website' ? (lead.publicContacts.website ? 100 : 0) : 50 };
  const score = Math.round(components.niche * .35 + components.businessType * .15 + components.need * .25 + components.location * .15 + components.contact * .10);
  return { score, explanation: { components, method: 'Token overlap and explicit field matches; no inferred intent or contact details.' } };
}

export function normalizeLeads(results: SearchResult[], input: LeadSearchInput) {
  const seen = new Set<string>();
  return results.map(normalizeLeadResult).filter((lead): lead is LeadRecord => !!lead).filter(lead => { const key = canonicalLeadKey(lead); if (seen.has(key)) return false; seen.add(key); return true; }).map(lead => ({ ...lead, canonicalKey: canonicalLeadKey(lead), ...scoreLead(lead, input) }));
}

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
export function leadsCsv(leads: Array<Record<string, unknown>>) {
  const columns = ['business_name', 'domain', 'source_url', 'description', 'location', 'status', 'score'];
  return [columns.join(','), ...leads.map(lead => columns.map(column => csvCell(lead[column])).join(','))].join('\n');
}
