import type { SearchResult } from './validation';

export const LEAD_STATUSES = ['new', 'qualified', 'contacted', 'in_conversation', 'won', 'not_fit', 'snoozed'] as const;
export type LeadStatus = typeof LEAD_STATUSES[number];
export type LeadSearchInput = { niche: string; location?: string; country?: string; businessType?: string; need?: string; sources?: string[]; contactPreference?: 'any' | 'email' | 'phone' | 'website'; limit?: number };
export type LeadEvidence = { businessName?: string; location?: string; contactName?: string; industry?: string; needSignal?: string; emails?: string; phones?: string };
export type LeadConfidence = { businessName: number; identity: number; location: number; contactName: number; industry: number; needSignal: number; contacts: number };
export type LeadRecord = { businessName: string; domain: string; sourceUrl: string; sourceTitle?: string; sourceDomain?: string; description: string; location?: string; contactName?: string; industry?: string; needSignal?: string; publicContacts: { emails?: string[]; phones?: string[]; website?: string }; evidence?: LeadEvidence; confidence?: LeadConfidence; qualityScore?: number };

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const tokens = (value: string) => new Set((value.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]{1,}/g) ?? []).filter(word => word.length > 2));
const overlap = (a: string, b: string) => { const left = tokens(a); const right = tokens(b); return left.size ? [...left].filter(word => right.has(word)).length / left.size : 0; };

export function leadSearchQuery(input: LeadSearchInput) {
  const parts = [input.niche, input.businessType, input.need, input.location, input.country].filter(Boolean);
  const sourceLabels = (input.sources ?? []).map(source => `Exa-indexed source label: ${source}`).join('; ');
  return `${parts.join(' ')}${sourceLabels ? ` ${sourceLabels}` : ''}. Identify public businesses with a relevant need; return original source pages only. ${input.contactPreference && input.contactPreference !== 'any' ? `Prefer pages with an explicitly published public ${input.contactPreference} contact.` : ''}`.trim();
}

function normalizePhone(value: string) {
  const explicitPlus = value.trim().startsWith('+');
  const digits = value.replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (explicitPlus) return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10)}`;
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value.replace(/\s+/g, ' ').trim();
}

function publicContacts(text: string, sourceUrl: string) {
  const emails = [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])].map(value => value.toLowerCase()).slice(0, 5);
  const phones = [...new Set((text.match(/(?:\+?\d[\d .()\-]{7,}\d)/g) ?? []).map(normalizePhone).filter((value): value is string => !!value))].slice(0, 5);
  let website: string | undefined;
  try { website = new URL(sourceUrl).origin; } catch { /* normalized discovery URLs are safe */ }
  return { ...(emails.length ? { emails } : {}), ...(phones.length ? { phones } : {}), ...(website ? { website } : {}) };
}

const junkPatterns = [/top\s+\d+\s+sites?\s+to\s+hire\s+freelancers?/i, /freelancer marketplace|hire freelancers?|best freelance websites?/i, /^(?:directory|business directory|search results|index|category|listing)s?\b/i, /\b(?:directory|search results|category page|all listings)\b/i, /\b(?:investor relations|quarterly results|annual report|sec filing|stock exchange filing|press release)\b/i];
const identityPattern = /\b(?:company|business|firm|agency|manufacturer|supplier|provider|contractor|clinic|studio|store|shop|engineers?|industr(?:y|ies)|contact us|about us)\b/i;
const cleanField = (value: string, max: number) => clean(value).replace(/^[-:|;,\s]+|[-:|;,\s]+$/g, '').slice(0, max);
const evidenceSnippet = (text: string, match: RegExpExecArray | null) => match?.[0] ? cleanField(match[0], 240) : undefined;

function conciseSummary(text: string, businessName: string) {
  const useful = clean(text).split(/(?<=[.!?])\s+/).find(sentence => sentence.length > 30 && !/^(?:cookie|privacy|sign in|subscribe)/i.test(sentence));
  return cleanField(useful ?? `${businessName} public business record.`, 600);
}

export function canonicalLeadKey(lead: LeadRecord) { return `${lead.domain.toLowerCase()}::${clean(lead.businessName).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.slice(0, 500); }

export function normalizeLeadResult(result: SearchResult): LeadRecord | null {
  let url: URL; try { url = new URL(result.url); } catch { return null; }
  const domain = url.hostname.toLowerCase().replace(/^www\./, '');
  const text = clean(`${result.title}. ${result.content ?? result.description}`);
  const sourceTitle = result.title.slice(0, 300);
  const businessName = clean(result.title).replace(/\s*[|–—-]\s*(?:justdial|indiamart|linkedin|reddit|exa).*$/i, '').replace(/\s*[|–—-]\s*(?:contact|about|home).*$/i, '').slice(0, 240);
  const locationMatch = /\b(?:located|based|location|serving|office|headquartered)\s*(?:in|at|:)\s*([A-Z][A-Za-z .,'-]{2,80}?)(?=\.|,?\s+(?:contact|email|phone|we\b)|$)/i.exec(text);
  const contactMatch = /\b(?:contact|speak with|ask for)\s+(?:mr\.?|ms\.?|mrs\.?|dr\.?)?\s*([A-Z][A-Za-z.'-]{2,40}(?:\s+[A-Z][A-Za-z.'-]{2,40})?)/i.exec(text);
  const industryMatch = /\b(?:specialist|specializes|provider|company|agency|firm|manufacturer|supplier|contractor|clinic|studio|store|shop)\s+(?:(?:is\s+)?(?:a|an)\s+)?(?:in|for|of)?\s*([A-Za-z][A-Za-z &/-]{2,80}?)(?=\.|,|\s+based\b|$)/i.exec(text);
  const needMatch = /\b(?:looking for|need(?:s)?|seeking|request(?:s|ed)?|want(?:s)?|problem)\s+([^.!?]{8,180})/i.exec(text);
  const contacts = publicContacts(text, url.toString());
  const junk = junkPatterns.some(pattern => pattern.test(`${sourceTitle} ${text}`));
  const identity = identityPattern.test(text) || !!contacts.emails?.length || !!contacts.phones?.length;
  const clearBusinessRecord = identityPattern.test(text) && !!(locationMatch || industryMatch || needMatch || contacts.emails?.length || contacts.phones?.length);
  if (!businessName || businessName.length < 2 || !identity || (junk && !clearBusinessRecord)) return null;
  const location = locationMatch?.[1] ? cleanField(locationMatch[1], 120) : undefined;
  const contactName = contactMatch?.[1] ? cleanField(contactMatch[1], 100) : undefined;
  const industry = industryMatch?.[1] ? cleanField(industryMatch[1], 120) : undefined;
  const needSignal = needMatch?.[1] ? cleanField(needMatch[1], 220) : undefined;
  const evidence: LeadEvidence = { businessName: cleanField(sourceTitle, 240), ...(location ? { location: evidenceSnippet(text, locationMatch) } : {}), ...(contactName ? { contactName: evidenceSnippet(text, contactMatch) } : {}), ...(industry ? { industry: evidenceSnippet(text, industryMatch) } : {}), ...(needSignal ? { needSignal: evidenceSnippet(text, needMatch) } : {}), ...(contacts.emails?.length ? { emails: contacts.emails.join(', ') } : {}), ...(contacts.phones?.length ? { phones: contacts.phones.join(', ') } : {}) };
  const confidence: LeadConfidence = { businessName: 0.9, identity: identity ? 0.85 : 0, location: location ? 0.9 : 0, contactName: contactName ? 0.85 : 0, industry: industry ? 0.8 : 0, needSignal: needSignal ? 0.85 : 0, contacts: contacts.emails?.length || contacts.phones?.length ? 0.95 : 0 };
  const qualityScore = Math.round((confidence.businessName * 25 + confidence.identity * 25 + confidence.contacts * 20 + confidence.location * 10 + confidence.industry * 10 + confidence.needSignal * 10) * (junk ? 0.65 : 1));
  return { businessName, domain, sourceUrl: url.toString(), sourceTitle, sourceDomain: domain, description: conciseSummary(text, businessName), ...(location ? { location } : {}), ...(contactName ? { contactName } : {}), ...(industry ? { industry } : {}), ...(needSignal ? { needSignal } : {}), publicContacts: contacts, evidence, confidence, qualityScore };
}

export function scoreLead(lead: LeadRecord, input: LeadSearchInput) {
  const haystack = `${lead.businessName} ${lead.description} ${lead.location ?? ''}`;
  const components = { niche: Math.round(overlap(input.niche, haystack) * 100), businessType: input.businessType ? Math.round(overlap(input.businessType, haystack) * 100) : 50, need: input.need ? Math.round(overlap(input.need, haystack) * 100) : 50, location: input.location ? (haystack.toLowerCase().includes(input.location.toLowerCase()) ? 100 : 0) : 50, contact: input.contactPreference === 'email' ? (lead.publicContacts.emails?.length ? 100 : 0) : input.contactPreference === 'phone' ? (lead.publicContacts.phones?.length ? 100 : 0) : input.contactPreference === 'website' ? (lead.publicContacts.website ? 100 : 0) : 50 };
  const score = Math.round(components.niche * .35 + components.businessType * .15 + components.need * .25 + components.location * .15 + components.contact * .10);
  return { score, explanation: { components, ...(lead.qualityScore !== undefined ? { qualityScore: lead.qualityScore } : {}), method: 'Token overlap and explicit field matches; no inferred intent or contact details.' } };
}

export function normalizeLeads(results: SearchResult[], input: LeadSearchInput) {
  const seen = new Set<string>();
  return results.map(normalizeLeadResult).filter((lead): lead is LeadRecord => !!lead).filter(lead => { const key = canonicalLeadKey(lead); if (seen.has(key)) return false; seen.add(key); return true; }).map(lead => ({ ...lead, canonicalKey: canonicalLeadKey(lead), ...scoreLead(lead, input) }));
}

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
export function leadsCsv(leads: Array<Record<string, unknown>>) {
  const columns = ['business_name', 'domain', 'source_url', 'description', 'location', 'status', 'score', 'quality_score'];
  return [columns.join(','), ...leads.map(lead => columns.map(column => csvCell(lead[column])).join(','))].join('\n');
}
