import { applicationOrigin, supabaseConfig } from './config';

type Environment = Record<string, string | undefined>;
type AuthConfig = { site_url?: string; uri_allow_list?: string; smtp_host?: string; external_email_enabled?: boolean; disable_signup?: boolean; mailer_autoconfirm?: boolean };
type Snapshot = { tables: string[]; ready: boolean };

// Metadata only: never read account emails, stored results, or auth credentials.
export const schemaProbe = `select
  coalesce((select array_agg(tablename::text order by tablename) from pg_tables
    where schemaname = 'public' and tablename in ('profiles','runs','monthly_usage','billing_events','checkout_leases')), '{}') as tables,
  (select count(*) = 5 and bool_and(rowsecurity) from pg_tables
    where schemaname = 'public' and tablename in ('profiles','runs','monthly_usage','billing_events','checkout_leases'))
  and to_regprocedure('public.reserve_run(uuid,text,text)') is not null
  and to_regprocedure('public.reserve_checkout(uuid,text)') is not null
  and to_regprocedure('public.apply_billing_event(text,bigint,timestamptz,uuid,text,text,text)') is not null
  and exists(select 1 from pg_trigger where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass and not tgisinternal)
  as ready;`;

export function projectReference(url: string): string {
  const parsed = new URL(url);
  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(parsed.hostname);
  if (parsed.protocol !== 'https:' || !match || parsed.username || parsed.password || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Automated setup requires the canonical hosted SUPABASE_URL.');
  return match[1];
}

export function redirectConfiguration(current: AuthConfig, origin: string) {
  const allow = new Set((current.uri_allow_list ?? '').split(',').map(value => value.trim()).filter(Boolean));
  allow.add(`${origin}/api/auth/callback`);
  allow.add(`${origin}/api/auth/callback?next=recovery`);
  // Preserve other applications' Site URLs and existing redirects. Explicit
  // redirectTo is used by ReachFlow; no wildcard or email-policy weakening.
  return { uri_allow_list: [...allow].join(','), ...(!current.site_url ? { site_url: origin } : {}) };
}

export async function setupSupabase(options: { env: Environment; apply: boolean; migration: string; fetcher?: typeof fetch; report?: (message: string) => void }) {
  const { env, apply, migration } = options;
  const report = options.report ?? (() => {});
  const token = env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('Missing SUPABASE_ACCESS_TOKEN. Add a Supabase management access token privately to .env.local, or complete the SQL migration and redirects in the Supabase dashboard. A project publishable/secret key cannot administer database schema or Auth configuration.');
  const ref = projectReference(supabaseConfig(env).url);
  const origin = applicationOrigin(env.APP_URL);
  const fetcher = options.fetcher ?? fetch;
  const base = `https://api.supabase.com/v1/projects/${ref}`;
  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetcher(base + path, { method, redirect: 'error', signal: AbortSignal.timeout(45_000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } catch { throw new Error('Supabase management request could not be confirmed. Re-run the read-only setup check before attempting changes again.'); }
    if (!response.ok) throw new Error(`Supabase management request failed (${response.status}). Check project access, token permissions, and the Supabase dashboard. Response details are intentionally not logged.`);
    return await response.json() as T;
  }
  async function inspect() {
    const data = await request<Snapshot[]>('/database/query', 'POST', { query: schemaProbe, read_only: true });
    if (!Array.isArray(data) || !data[0] || !Array.isArray(data[0].tables) || typeof data[0].ready !== 'boolean') throw new Error('Unexpected schema response. No automatic schema changes will be attempted.');
    return data[0];
  }
  let snapshot = await inspect();
  const auth = await request<AuthConfig>('/config/auth');
  report(`Project: ${ref}. App origin: ${origin}. Mode: ${apply ? 'apply' : 'read-only preview'}.`);
  report(`ReachFlow tables present: ${snapshot.tables.length}/5. Schema checks: ${snapshot.ready ? 'passed' : 'incomplete'}.`);
  report(`Email signup: ${auth.external_email_enabled && !auth.disable_signup ? 'enabled' : 'needs operator review'}. Custom SMTP: ${auth.smtp_host ? 'configured (delivery not tested)' : 'not configured; default sender may restrict recipients'}.`);
  const patch = redirectConfiguration(auth, origin);
  const needsRedirects = patch.uri_allow_list !== (auth.uri_allow_list ?? '') || !!patch.site_url;
  if (!snapshot.ready && snapshot.tables.length) throw new Error('Partial or conflicting schema detected. Automatic setup stopped to preserve existing data. Review the migration in the Supabase SQL editor.');
  report(snapshot.ready ? 'Initial migration already present; no schema changes planned.' : 'Will apply supabase/migrations/001_initial.sql transactionally (creates tables, RLS, quotas, and profile trigger).');
  report(needsRedirects ? 'Will add the two exact ReachFlow callback URLs while preserving existing redirects and email-confirmation policy.' : 'ReachFlow callback URLs already allowed.');
  if (!apply) { report('Preview only. Run with --apply after reviewing the target and planned changes.'); return { applied: false, databaseReady: snapshot.ready, redirectsReady: !needsRedirects }; }
  if (!snapshot.ready) {
    if (!migration.trim()) throw new Error('The migration file is empty. Setup stopped.');
    await request('/database/query', 'POST', { query: `begin;\n${migration}\nnotify pgrst, 'reload schema';\ncommit;`, read_only: false });
    snapshot = await inspect();
    if (!snapshot.ready) throw new Error('Migration verification failed. Inspect the Supabase SQL editor before proceeding.');
    report('Database schema created and verified.');
  }
  if (needsRedirects) await request('/config/auth', 'PATCH', patch);
  const verified = await request<AuthConfig>('/config/auth');
  const allow = (verified.uri_allow_list ?? '').split(',').map(value => value.trim());
  if (!allow.includes(`${origin}/api/auth/callback`) || !allow.includes(`${origin}/api/auth/callback?next=recovery`)) throw new Error('Email redirect verification failed. Review Supabase Auth URL Configuration.');
  report('Database metadata and email redirect settings verified. Real signup/email delivery still requires an inbox test.');
  if (!supabaseConfig(env).secretKey) report('Search persistence still needs a rotated SUPABASE_SECRET_KEY in .env.local. Do not share it in chat.');
  return { applied: true, databaseReady: true, redirectsReady: true };
}
