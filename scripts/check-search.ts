import { loadEnvConfig } from '@next/env';
import { discover } from '../lib/discovery';

async function main() {
  loadEnvConfig(process.cwd());
  const kind = process.argv[2] ?? 'jobs';
  if (kind !== 'jobs' && kind !== 'clients' && kind !== 'research') throw new Error('Usage: npm run check:search -- jobs|clients|research "public search query"');
  const query = process.argv[3] ?? 'Remote React developer job openings';
  if (query.length < 3 || query.length > 500) throw new Error('Search query must be 3–500 characters.');
  const result = await discover(query, kind);
  console.log(JSON.stringify({ provider: result.provider, count: result.results.length, results: result.results.map(({ title, url, source }) => ({ title, url, source })) }, null, 2));
  console.log('Connector-only check: this does not verify account sessions, persistence, quotas, or whether listings are still open.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Search check failed.'); process.exitCode = 1; });
