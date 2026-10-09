import { z } from 'zod';

export const RESULT_LIMITS = { free: 10, starter: 50, pro: 100 } as const;
export const SOCIAL_SOURCES = {
  reddit: { label: 'Reddit', domains: ['reddit.com'] },
  linkedin: { label: 'LinkedIn', domains: ['linkedin.com'] },
  youtube: { label: 'YouTube', domains: ['youtube.com', 'youtu.be'] },
  x: { label: 'X / Twitter', domains: ['x.com', 'twitter.com'] },
  facebook: { label: 'Facebook', domains: ['facebook.com'] },
  instagram: { label: 'Instagram', domains: ['instagram.com'] },
  tiktok: { label: 'TikTok', domains: ['tiktok.com'] },
  github: { label: 'GitHub', domains: ['github.com'] },
} as const;
export type SocialSource = keyof typeof SOCIAL_SOURCES;
const domain = z.string().trim().toLowerCase().max(253).refine(value => {
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) return false;
  return !/\.(local|localhost|internal|test|invalid)$/.test(value);
}, 'Use public hostnames only, such as reddit.com (no URLs, paths, ports or wildcards).');
const instant = z.string().datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value)), 'Invalid date/time');
export const searchFiltersSchema = z.object({
  publishedAfter: instant.optional(), publishedBefore: instant.optional(),
  location: z.string().trim().min(2).max(100).optional(),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  includeDomains: z.array(domain).max(20).optional(),
  excludeDomains: z.array(domain).max(20).optional(),
  sources: z.array(z.enum(['reddit', 'linkedin', 'youtube', 'x', 'facebook', 'instagram', 'tiktok', 'github'])).max(8).optional(),
}).strict().superRefine((filters, ctx) => {
  if (filters.publishedAfter && filters.publishedBefore && Date.parse(filters.publishedAfter) >= Date.parse(filters.publishedBefore)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Published before must be later than published after.' });
  const includes = includedDomains(filters);
  if (includes.length && includes.every(host => (filters.excludeDomains ?? []).some(block => domainMatches(host, block)))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Your block list excludes every allowed website.' });
});
export type SearchFilters = z.infer<typeof searchFiltersSchema>;
export type SearchOptions = { limit: number; filters: SearchFilters; detailed: boolean };
export function domainMatches(host: string, domain: string) { return host === domain || host.endsWith(`.${domain}`); }
export function includedDomains(filters: SearchFilters): string[] {
  // Source presets and typed domains form an explicit union. Exclusions win.
  return [...new Set([...(filters.includeDomains ?? []), ...(filters.sources ?? []).flatMap(source => [...SOCIAL_SOURCES[source].domains])])];
}
export function cleanFilters(filters: SearchFilters = {}): SearchFilters {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && (!Array.isArray(value) || value.length > 0)));
}
export class SearchAccessError extends Error { constructor(public status: number, message: string) { super(message); } }
export function authorizeSearch(plan: string, input: { limit?: number; filters?: SearchFilters }): SearchOptions {
  const paid = plan === 'starter' || plan === 'pro';
  const maximum = plan === 'pro' ? 100 : plan === 'starter' ? 50 : 10;
  const limit = input.limit ?? maximum;
  if (!Number.isInteger(limit) || limit < 1 || limit > maximum) throw new SearchAccessError(403, `Your ${paid ? plan : 'free'} plan allows up to ${maximum} results per search.`);
  const filters = cleanFilters(input.filters);
  if (!paid && Object.keys(filters).length) throw new SearchAccessError(403, 'Advanced filters require a Starter or Pro plan.');
  return { limit, filters, detailed: paid };
}
export function providerFilters(filters: SearchFilters) {
  const includeDomains = includedDomains(filters);
  return {
    ...(includeDomains.length ? { includeDomains } : {}),
    ...(filters.excludeDomains?.length ? { excludeDomains: [...new Set(filters.excludeDomains)] } : {}),
    ...(filters.publishedAfter ? { startPublishedDate: filters.publishedAfter } : {}),
    ...(filters.publishedBefore ? { endPublishedDate: filters.publishedBefore } : {}),
    ...(filters.country ? { userLocation: filters.country } : {}),
  };
}
