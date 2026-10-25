import { z } from 'zod';
import { searchFiltersSchema } from './search-options';

export const searchSchema = z.object({ query: z.string().trim().min(3).max(500), kind: z.enum(['jobs', 'clients', 'research']), limit: z.number().int().min(1).max(100).optional(), filters: searchFiltersSchema.optional() }).strict();
const email = z.string().trim().email().max(254);
const newPassword = z.string().min(8).max(128);
export const authSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('oauth'), provider: z.literal('google') }).strict(),
  z.object({ action: z.literal('login'), email, password: z.string().min(1).max(128) }).strict(),
  z.object({ action: z.literal('signup'), email, password: newPassword }).strict(),
  z.object({ action: z.literal('reset'), email }).strict(),
  z.object({ action: z.literal('resend'), email }).strict(),
  z.object({ action: z.literal('logout') }).strict(),
  z.object({ action: z.literal('update-password'), password: newPassword }).strict(),
]);
export const checkoutSchema = z.object({ plan: z.enum(['starter', 'pro']) }).strict();
export const LIMITS = { free: 10, starter: 100, pro: 500 } as const;
export type Plan = keyof typeof LIMITS;
export function quotaLimit(plan: string): number { return Object.prototype.hasOwnProperty.call(LIMITS, plan) ? LIMITS[plan as Plan] : LIMITS.free; }
export function hasQuota(plan: string, used: number): boolean { return Number.isInteger(used) && used >= 0 && used < quotaLimit(plan); }
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal') || host.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    return url.toString();
  } catch { return null; }
}
export type SearchResult = { id: string; title: string; url: string; description: string; source: string; publishedAt?: string; author?: string; content?: string; provider?: string; corroboration?: { url: string; provider: string; text: string }[] };
export function sortResults(results: SearchResult[]): SearchResult[] {
  return results
    .map((result, index) => ({ result, index, time: result.publishedAt ? Date.parse(result.publishedAt) : NaN }))
    .sort((a, b) => {
      const aDated = Number.isFinite(a.time);
      const bDated = Number.isFinite(b.time);
      if (aDated !== bDated) return aDated ? -1 : 1;
      if (!aDated) return a.index - b.index;
      return b.time - a.time || a.index - b.index;
    })
    .map(({ result }) => result);
}
export function normalizeResults(data: unknown, options: { limit?: number; detailed?: boolean } = {}): SearchResult[] {
  if (!data || typeof data !== 'object' || !('results' in data) || !Array.isArray(data.results)) return [];
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  const limit = Math.min(100, Math.max(1, Math.floor(options.limit || 10)));
  for (const item of data.results) {
    if (!item || typeof item !== 'object') continue;
    const url = safeUrl(item.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const text = typeof item.text === 'string' ? item.text : Array.isArray(item.highlights) ? item.highlights.filter((v: unknown) => typeof v === 'string').join('\n') : '';
    const publishedAt = typeof item.publishedDate === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(item.publishedDate) && Number.isFinite(Date.parse(item.publishedDate)) ? new Date(item.publishedDate).toISOString() : undefined;
    results.push({ id: String(results.length + 1), title: typeof item.title === 'string' ? item.title.slice(0, 300) : new URL(url).hostname, url, description: text.slice(0, 1200), source: new URL(url).hostname,
      ...(publishedAt ? { publishedAt } : {}),
      ...(typeof item.author === 'string' && item.author.trim() && item.author !== 'N/A' ? { author: item.author.slice(0, 200) } : {}),
      ...(options.detailed && text ? { content: text.slice(0, 6000) } : {}),
    });
  }
  return sortResults(results).slice(0, limit).map((result, index) => ({ ...result, id: String(index + 1) }));
}

const boundedText = (max: number) => z.string().trim().min(1).max(max);
export const profileSchema = z.object({
  fullName: z.string().trim().max(160).optional(), headline: z.string().trim().max(240).optional(), summary: z.string().trim().max(4000).optional(),
  location: z.string().trim().max(160).optional(), workAuthorization: z.string().trim().max(240).optional(),
  targets: z.string().trim().max(4000).optional(),
  skills: z.array(boundedText(80)).max(100).optional(), experience: z.string().trim().max(12000).optional(),
  education: z.string().trim().max(4000).optional(), preferences: z.object({
    titles: z.array(boundedText(120)).max(30).optional(), locations: z.array(boundedText(120)).max(30).optional(),
    remote: z.boolean().optional(), employmentTypes: z.array(z.enum(['full-time','part-time','contract','internship'])).max(10).optional(),
  }).strict().optional(), resume: z.object({ text: z.string().trim().max(30000), fileName: z.string().trim().max(200).optional() }).strict().optional(),
}).strict();
export const jobResultSchema = z.object({ title: boundedText(300), company: z.string().trim().max(240).optional(), location: z.string().trim().max(240).optional(), employmentType: z.string().trim().max(80).optional(), requirements: z.string().trim().max(12000).optional(), description: boundedText(30000), content: z.string().trim().max(30000).optional(), publishedAt: z.string().datetime({ offset: true }).optional(), author: z.string().trim().max(200).optional(), provider: z.string().trim().max(80).optional(), url: z.string().trim().max(2048).refine(value => !!safeUrl(value), 'Only safe HTTPS URLs are allowed').optional(), source: z.string().trim().max(120).optional() }).strict();
export const saveJobSchema = z.object({ action: z.enum(['save', 'prepare']), result: jobResultSchema }).strict();
export const jobPatchSchema = jobResultSchema.partial().extend({ status: z.enum(['saved','archived','applied']).optional() }).strict();
export const applicationCreateSchema = z.object({ jobId: z.string().uuid(), notes: z.string().trim().max(8000).optional() }).strict();
export const applicationPatchSchema = z.object({ status: z.enum(['draft','ready','submitted','withdrawn','rejected','interviewing','offer']).optional(), notes: z.string().trim().max(8000).optional() }).strict();
export const generateSchema = z.object({ include: z.array(z.enum(['coverLetter','resume','interviewQuestions'])).max(3).optional() }).strict();
export const jobHuntPlanSchema = z.object({
  targetRole: z.string().trim().min(2).max(160), experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead']),
  locations: z.string().trim().min(2).max(240), remote: z.boolean(), startDate: z.string().date(),
  targetApplications: z.number().int().min(1).max(50), targetOutreach: z.number().int().min(0).max(30),
  completedDays: z.array(z.number().int().min(1).max(7)).max(7),
}).strict();
const verifiedWebsite = z.string().trim().max(2048).refine(value => !!safeUrl(value), 'Use a public HTTPS company website.');
const salary = z.number().finite().min(0).max(100000000).nullable().optional();
const employerJobFields = {
  title: z.string().trim().min(3).max(180),
  location: z.string().trim().min(2).max(180),
  workplace_type: z.enum(['remote', 'hybrid', 'onsite']),
  employment_type: z.enum(['full-time', 'part-time', 'contract', 'internship']),
  experience_level: z.enum(['entry', 'mid', 'senior', 'lead']),
  salary_min: salary,
  salary_max: salary,
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default('USD'),
  description: z.string().trim().min(40).max(20000),
  requirements: z.string().trim().max(12000).default(''),
};
export const employerCompanySchema = z.object({ name: z.string().trim().min(2).max(160), websiteUrl: verifiedWebsite, description: z.string().trim().max(4000).default('') }).strict();
export const employerJobSchema = z.object(employerJobFields).strict().refine(value => value.salary_min == null || value.salary_max == null || value.salary_max >= value.salary_min, { message: 'Salary maximum must be at least the salary minimum.', path: ['salary_max'] });
export const employerJobPatchSchema = z.object({
  title: employerJobFields.title.optional(), location: employerJobFields.location.optional(), workplace_type: employerJobFields.workplace_type.optional(),
  employment_type: employerJobFields.employment_type.optional(), experience_level: employerJobFields.experience_level.optional(),
  salary_min: salary, salary_max: salary, currency: employerJobFields.currency.optional(), description: employerJobFields.description.optional(),
  requirements: employerJobFields.requirements.optional(), action: z.enum(['publish', 'close', 'reopen']).optional(),
}).strict().refine(value => value.salary_min == null || value.salary_max == null || value.salary_max >= value.salary_min, { message: 'Salary maximum must be at least the salary minimum.', path: ['salary_max'] });
export const employerApplicationPatchSchema = z.object({ status: z.enum(['submitted', 'reviewing', 'interview', 'rejected', 'hired', 'withdrawn']).optional(), employer_note: z.string().trim().max(8000).optional() }).strict();
export const employerBoardQuerySchema = z.object({ query: z.string().trim().max(120).optional(), location: z.string().trim().max(120).optional(), limit: z.coerce.number().int().min(1).max(50).default(24) }).strict();
export const jobBoardApplySchema = z.object({ coverNote: z.string().trim().max(4000).optional() }).strict();
export const jobPromotionSchema = z.object({ targetCents: z.number().int().min(1000).max(99999900) }).strict();
export const byokSettingsSchema = z.object({ provider: z.literal('openai-compatible'), model: z.string().trim().min(1).max(200), baseUrl: z.string().trim().min(1).max(2048), apiKey: z.string().min(1).max(4096) }).strict();
const leadText = (max: number) => z.string().trim().min(1).max(max);
export const leadSearchSchema = z.object({
  niche: leadText(160), location: leadText(160).optional(), country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(), businessType: leadText(120).optional(), need: leadText(240).optional(),
  sources: z.array(leadText(80)).max(8).optional(), contactPreference: z.enum(['any', 'email', 'phone', 'website']).optional(), limit: z.number().int().min(1).max(50).optional(),
}).strict();
export const leadStatusSchema = z.enum(['new', 'qualified', 'contacted', 'in_conversation', 'won', 'not_fit', 'snoozed']);
export const leadPatchSchema = z.object({ status: leadStatusSchema.optional(), notes: z.string().trim().max(8000).optional() }).strict();
export const leadNoteSchema = z.object({ body: leadText(4000) }).strict();
export const leadListSchema = z.object({ status: leadStatusSchema.optional(), limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).max(10000).default(0), format: z.enum(['json', 'csv']).default('json') }).strict();
const housingText = (max: number) => z.string().trim().min(1).max(max);
const housingAreas = z.array(housingText(120)).max(20);
export const housingPreferencesSchema = z.object({
  city: housingText(160), areas: housingAreas.optional(), minRent: z.number().int().min(0).max(1000000).optional(), maxRent: z.number().int().min(0).max(1000000).optional(),
  bedrooms: z.number().int().min(0).max(10).optional(), propertyTypes: z.array(z.enum(['apartment', 'house', 'room', 'studio', 'pg'])).max(10).optional(), furnished: z.enum(['any', 'furnished', 'semi_furnished', 'unfurnished']).default('any'), moveInDate: z.string().date().optional(), needs: z.array(z.enum(['parking', 'pets', 'wifi', 'power_backup', 'security', 'balcony'])).max(10).default([]), consentToBrokerContact: z.boolean().default(false),
}).strict().refine(value => value.maxRent === undefined || value.minRent === undefined || value.maxRent >= value.minRent, { message: 'maxRent must be at least minRent', path: ['maxRent'] });
export const housingMatchSchema = z.object({ preferenceId: z.string().uuid().optional(), limit: z.number().int().min(1).max(50).default(20) }).strict();
export const housingListingActionSchema = z.object({ action: z.enum(['save', 'dismiss']) }).strict();
export const brokerRequestSchema = z.object({ listingId: z.string().uuid().optional(), brokerId: z.string().uuid(), message: housingText(2000), consent: z.literal(true) }).strict();
export function isAllowedByokUrl(value: string, env: Record<string, string | undefined> = process.env): boolean {
  try { const url = new URL(value); const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase()); if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) return false; if (local) return env.APP_ENV !== 'production'; if (!url.hostname.includes('.') || url.port && url.port !== '443') return false; const host = url.hostname.toLowerCase().replace(/\.$/, ''); if (host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.home.arpa')) return false; if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host) || /^\d+(?:\.\d+){3}$/.test(host)) return false; return true; } catch { return false; }
}
