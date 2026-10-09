import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnvConfig } from '@next/env';
import { setupSupabase } from '../lib/supabase-setup';

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--help'].includes(arg))) throw new Error('Usage: npm run setup:supabase [-- --apply]');
  if (args.includes('--help')) { console.log('Preview: npm run setup:supabase\nApply: npm run setup:supabase -- --apply\nRequires SUPABASE_ACCESS_TOKEN in ignored .env.local. Never pass credentials as command arguments.'); return; }
  loadEnvConfig(process.cwd());
  const migration = await readFile(resolve(process.cwd(), 'supabase/migrations/001_initial.sql'), 'utf8');
  await setupSupabase({ env: process.env, apply: args.includes('--apply'), migration, report: console.log });
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Supabase setup failed.'); process.exitCode = 1; });
