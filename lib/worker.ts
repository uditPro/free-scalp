import type { SearchFilters, SearchOptions } from './search-options';
import type { SearchResult } from './validation';

type Environment = Record<string, string | undefined>;
export class WorkerError extends Error {}
function workerSources(filters: SearchFilters) { return filters.sources ?? []; }
export async function localWorkerSearch(query: string, options: SearchOptions, env: Environment = process.env): Promise<{ results: SearchResult[]; warnings: string[] } | null> {
  const base = env.REACHFLOW_WORKER_URL?.trim(); const token = env.REACHFLOW_WORKER_TOKEN?.trim();
  if (!base || !token) return null;
  let url: URL;
  try { url = new URL('/v1/search', base); if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') throw new Error(); } catch { throw new WorkerError('The local Agent-Reach worker URL must use http://127.0.0.1 or localhost.'); }
  const response = await fetch(url, { method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, limit: options.limit, sources: workerSources(options.filters) }), signal: AbortSignal.timeout(60_000), cache: 'no-store' });
  if (response.status === 404 || response.status === 502 || response.status === 503) return null;
  if (!response.ok) throw new WorkerError('The local Agent-Reach worker returned an error. Check its terminal for connector details.');
  const payload = await response.json() as { results?: SearchResult[]; warnings?: string[] };
  if (!Array.isArray(payload.results)) throw new WorkerError('The local Agent-Reach worker returned an invalid response.');
  return { results: payload.results, warnings: payload.warnings ?? [] };
}
