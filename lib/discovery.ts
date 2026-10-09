import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { normalizeResults, type SearchResult } from './validation';
import { domainMatches, includedDomains, providerFilters, type SearchOptions, type SearchFilters } from './search-options';
import { localWorkerSearch } from './worker';

type Kind = 'jobs' | 'clients' | 'research';
type Environment = Record<string, string | undefined>;
export type DiscoveryProvider = 'exa-api' | 'exa-mcp';
export class DiscoveryError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function discoveryProvider(env: Environment = process.env): DiscoveryProvider {
  const configured = env.SEARCH_PROVIDER?.trim();
  if (configured && configured !== 'auto' && configured !== 'exa-api' && configured !== 'exa-mcp') throw new DiscoveryError(503, 'The search provider configuration is invalid.');
  const provider: DiscoveryProvider = !configured || configured === 'auto' ? (env.EXA_API_KEY?.trim() ? 'exa-api' : 'exa-mcp') : configured as DiscoveryProvider;
  if (provider === 'exa-api' && !env.EXA_API_KEY?.trim()) throw new DiscoveryError(503, 'The Exa API key is not configured.');
  return provider;
}

export function discoveryQuery(query: string, kind: Kind) {
  const prefix = { jobs: 'Job openings and hiring opportunities: ', clients: 'Public requests to hire freelancers or independent service providers: ', research: '' }[kind];
  return {
    query: prefix + query,
    objective: {
      jobs: 'Find relevant original job postings and job-board listings with source URLs. Prefer recent direct employer postings. Do not invent roles, infer open status, or guarantee availability.',
      clients: 'Find relevant public requests for services, freelance project postings, and discussions of a specific need. Prefer requests by prospective buyers, not lists of agencies selling services. Do not infer purchase intent or invent contacts.',
      research: 'Find useful original sources and substantive public discussions directly relevant to the query, with source URLs. Do not invent findings.',
    }[kind],
  };
}

// Exa MCP currently returns Title/URL/Highlights text. Also accept structured
// results when available. Treat all descriptions as untrusted plain text.
export function parseMcpResults(payload: unknown, options: { limit?: number; detailed?: boolean } = {}): SearchResult[] {
  if (!payload || typeof payload !== 'object') throw new DiscoveryError(502, 'Search returned an invalid response.');
  const data = payload as { isError?: boolean; structuredContent?: { results?: unknown[] }; content?: { type?: string; text?: string }[] };
  if (data.isError) {
    const limited = Array.isArray(data.content) && data.content.some(block => typeof block.text === 'string' && /rate.?limit|too many requests|quota exceeded/i.test(block.text));
    throw new DiscoveryError(limited ? 429 : 502, limited ? 'The shared Exa search limit was reached. Try later, or configure a dedicated Exa API key.' : 'The search provider could not complete this query. Please try again later.');
  }
  if (Array.isArray(data.structuredContent?.results)) return normalizeResults({ results: data.structuredContent.results }, options);
  if (!Array.isArray(data.content)) throw new DiscoveryError(502, 'Search returned an invalid response.');
  const blocks = data.content.filter(block => block.type === 'text' && typeof block.text === 'string').map(block => block.text!);
  if (!blocks.length) throw new DiscoveryError(502, 'Search returned no readable result data.');
  const rows: { title: string; url: string; text: string; publishedDate?: string; author?: string }[] = [];
  let structured = false;
  for (const text of blocks) {
    if (text.length > (options.detailed ? 1_000_000 : 250_000)) throw new DiscoveryError(502, 'Search returned an oversized response.');
    // Advanced Exa may return one JSON object in a text block. Parse only its
    // declared results array; arbitrary links inside prose never become results.
    try {
      const parsed = JSON.parse(text) as { results?: unknown[] };
      if (Array.isArray(parsed.results)) {
        structured = true;
        rows.push(...parsed.results.filter(item => item && typeof item === 'object').map(item => {
          const value = item as Record<string, unknown>;
          return { title: typeof value.title === 'string' ? value.title : '', url: typeof value.url === 'string' ? value.url : '', text: typeof value.text === 'string' ? value.text : Array.isArray(value.highlights) ? value.highlights.filter(v => typeof v === 'string').join('\n') : '', publishedDate: typeof value.publishedDate === 'string' ? value.publishedDate : undefined, author: typeof value.author === 'string' ? value.author : undefined };
        }));
        continue;
      }
    } catch { /* Exa's plain text format is handled below. */ }
    // Separators are emitted by Exa between result records. We do not interpret
    // arbitrary links inside page excerpts as additional discoveries.
    for (const record of text.replaceAll('\r\n', '\n').split(/\n---\n/)) {
      const match = /^\s*Title:\s*([^\n]+)\nURL:\s*(https?:\/\/[^\s]+)\n([\s\S]*)$/.exec(record);
      if (!match) continue;
      const publishedDate = /^Published(?: Date)?:\s*([^\n]+)/m.exec(match[3])?.[1]?.trim();
      const author = /^Author:\s*([^\n]+)/m.exec(match[3])?.[1]?.trim();
      const excerpt = match[3].replace(/^(?:Published(?: Date)?:[^\n]*\n|Author:[^\n]*\n)*/, '').replace(/^(?:Highlights|Text|Content):\s*/, '').trim();
      rows.push({ title: match[1].trim(), url: match[2], text: excerpt, publishedDate, author });
    }
  }
  if (!rows.length && !structured && !blocks.every(block => /no (?:search )?results|no matching|^\s*$/.test(block.toLowerCase()))) throw new DiscoveryError(502, 'The search provider returned an unsupported result format.');
  return normalizeResults({ results: rows }, options);
}

export function filterResults(results: SearchResult[], filters: SearchFilters): SearchResult[] {
  const includes = includedDomains(filters);
  return results.filter(result => {
    const host = new URL(result.url).hostname.toLowerCase();
    if (includes.length && !includes.some(domain => domainMatches(host, domain))) return false;
    if ((filters.excludeDomains ?? []).some(domain => domainMatches(host, domain))) return false;
    if (filters.publishedAfter || filters.publishedBefore) {
      // Unknown publication dates cannot truthfully satisfy a date restriction.
      if (!result.publishedAt) return false;
      const date = Date.parse(result.publishedAt);
      if (filters.publishedAfter && date < Date.parse(filters.publishedAfter)) return false;
      if (filters.publishedBefore && date > Date.parse(filters.publishedBefore)) return false;
    }
    return true;
  });
}

export async function discover(query: string, kind: Kind, env: Environment = process.env, options: SearchOptions = { limit: 10, filters: {}, detailed: false }): Promise<{ results: SearchResult[]; provider: DiscoveryProvider; warnings: string[] }> {
  const provider = discoveryProvider(env);
  const input = discoveryQuery(query, kind);
  if (options.filters.location) input.query += `\nLocation preference: ${options.filters.location}`;
  const advanced = options.detailed || options.limit > 10 || Object.keys(options.filters).length > 0;
  const filters = providerFilters(options.filters);
  const finish = (rows: SearchResult[]) => {
    const results = filterResults(rows, options.filters);
    const warnings: string[] = ['Results are public indexed pages, not authenticated social-media scraping. Availability and completeness vary by source.'];
    if (results.length < options.limit) warnings.push(`Requested up to ${options.limit}; ${results.length} unique matching sources returned. No additional matches are invented.`);
    if (options.filters.location || options.filters.country) warnings.push('Location is a relevance preference, not verified employer location or work eligibility. Check the original listing.');
    if (options.filters.publishedAfter || options.filters.publishedBefore) warnings.push('Publication-time filtering uses provider metadata; undated sources are excluded. This is not a guarantee that a job is still open.');
    if (options.detailed) warnings.push('Expanded source excerpts are limited to 6,000 characters when available. Missing contact, salary, or company details are not inferred.');
    return { results, provider, warnings };
  };
  const worker = await localWorkerSearch(query, options, env).catch(error => {
    if (error instanceof Error && error.name === 'AbortError') return null;
    throw error;
  });
  const workerResults = worker?.results ?? [];
  const workerWarnings = worker?.warnings ?? [];
  const merge = (remote: SearchResult[]) => {
    const seen = new Set<string>();
    return [...workerResults, ...remote].filter(result => { if (seen.has(result.url)) return false; seen.add(result.url); return true; }).slice(0, options.limit);
  };
  if (provider === 'exa-api') {
    const upstream = await fetch('https://api.exa.ai/search', {
      method: 'POST', redirect: 'error',
      headers: { 'x-api-key': env.EXA_API_KEY!.trim(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: input.query, type: 'auto', numResults: options.limit, ...filters, contents: { text: { maxCharacters: options.detailed ? 6000 : 1200 } } }),
      signal: AbortSignal.timeout(25_000), cache: 'no-store',
    });
    if (upstream.status === 429) throw new DiscoveryError(429, 'The Exa search limit was reached. Please try again later.');
    if (!upstream.ok) throw new DiscoveryError(502, 'The search provider could not complete this query.');
    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== 'object' || !('results' in payload) || !Array.isArray(payload.results)) throw new DiscoveryError(502, 'Search returned an invalid response.');
    const combined = finish(merge(normalizeResults(payload, options)));
    return { ...combined, warnings: [...workerWarnings, ...combined.warnings, ...(workerResults.length ? ['Local Agent-Reach worker results were included from tools explicitly installed and authorized on this Windows machine.'] : [])] };
  }
  // Agent-Reach routes its web search through this same upstream service.
  // Use a fixed HTTPS host, not arbitrary URLs or shell commands from users.
  const client = new Client({ name: 'reachflow', version: '1.0.0' });
  const endpoint = advanced ? 'https://mcp.exa.ai/mcp?tools=web_search_advanced_exa' : 'https://mcp.exa.ai/mcp';
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), { requestInit: { signal: AbortSignal.timeout(45_000), redirect: 'error' } });
  try {
    await client.connect(transport);
    const response = await client.callTool(advanced
      ? { name: 'web_search_advanced_exa', arguments: { query: input.query, type: 'auto', numResults: options.limit, ...filters, textMaxCharacters: options.detailed ? 6000 : 1200, enableHighlights: false } }
      : { name: 'web_search_exa', arguments: { ...input, numResults: options.limit } }, undefined, { timeout: 40_000 });
    const combined = finish(merge(parseMcpResults(response, options)));
    return { ...combined, warnings: [...workerWarnings, ...combined.warnings, ...(workerResults.length ? ['Local Agent-Reach worker results were included from tools explicitly installed and authorized on this Windows machine.'] : [])] };
  } catch (error) {
    if (error instanceof DiscoveryError) throw error;
    throw new DiscoveryError(502, 'The Exa MCP connection is unavailable. Try again later or configure a dedicated Exa API key.');
  } finally { await client.close().catch(() => {}); }
}
