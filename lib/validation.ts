import { z } from 'zod';
import { searchFiltersSchema } from './search-options';

export const searchSchema = z.object({ query: z.string().trim().min(3).max(500), kind: z.enum(['jobs', 'clients', 'research']), limit: z.number().int().min(1).max(100).optional(), filters: searchFiltersSchema.optional() }).strict();
const email = z.string().trim().email().max(254);
const newPassword = z.string().min(8).max(128);
export const authSchema = z.discriminatedUnion('action', [
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
export type SearchResult = { id: string; title: string; url: string; description: string; source: string; publishedAt?: string; author?: string; content?: string };
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
    if (results.length === limit) break;
  }
  return results;
}
