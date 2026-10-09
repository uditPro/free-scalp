import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectReference, redirectConfiguration, schemaProbe, setupSupabase } from '../lib/supabase-setup';

const ref = 'abcdefghijklmnopqrst';
const env = { APP_URL: 'http://localhost:3000', SUPABASE_URL: `https://${ref}.supabase.co`, SUPABASE_ACCESS_TOKEN: 'test-management-token' };
const tables = ['billing_events', 'checkout_leases', 'monthly_usage', 'profiles', 'runs'];
const baseAuth = { site_url: 'https://existing-app.example', uri_allow_list: 'https://existing-app.example/callback', external_email_enabled: true, disable_signup: false, mailer_autoconfirm: false };

test('setup never sends management credentials to a URL taken directly from configuration', () => {
  assert.equal(projectReference(env.SUPABASE_URL), ref);
  for (const bad of ['https://evil.example', `https://${ref}.supabase.co.evil.example`, `http://${ref}.supabase.co`, `https://user:pass@${ref}.supabase.co`, `https://${ref}.supabase.co/path`]) assert.throws(() => projectReference(bad));
});

test('redirect setup preserves existing apps and cannot disable email confirmation', () => {
  const patch = redirectConfiguration(baseAuth, env.APP_URL);
  assert.ok(patch.uri_allow_list.includes(baseAuth.uri_allow_list));
  assert.ok(patch.uri_allow_list.includes('http://localhost:3000/api/auth/callback?next=recovery'));
  assert.equal('mailer_autoconfirm' in patch, false);
  assert.equal('disable_signup' in patch, false);
  assert.equal('site_url' in patch, false);
  assert.equal(redirectConfiguration({ ...baseAuth, ...patch }, env.APP_URL).uri_allow_list, patch.uri_allow_list);
});

test('setup without a management token fails before network access', async () => {
  await assert.rejects(setupSupabase({ env: { ...env, SUPABASE_ACCESS_TOKEN: '' }, apply: true, migration: 'test', fetcher: async () => { throw new Error('Network must not be used'); } }), /Missing SUPABASE_ACCESS_TOKEN/);
});

test('preview performs metadata reads only and never leaks credentials or SMTP configuration', async () => {
  const messages: string[] = []; let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls++; assert.ok(String(url).startsWith(`https://api.supabase.com/v1/projects/${ref}/`));
    assert.equal(init?.redirect, 'error');
    if (String(url).endsWith('/database/query')) { const body = JSON.parse(String(init?.body)); assert.equal(body.read_only, true); assert.equal(body.query, schemaProbe); return Response.json([{ tables: [], ready: false }]); }
    assert.equal(init?.method, 'GET');
    return Response.json({ ...baseAuth, smtp_pass: 'private-smtp-password' });
  };
  const result = await setupSupabase({ env, apply: false, migration: 'create table...', fetcher, report: text => messages.push(text) });
  assert.equal(calls, 2); assert.equal(result.applied, false);
  assert.equal(messages.join().includes(env.SUPABASE_ACCESS_TOKEN), false);
  assert.equal(messages.join().includes('private-smtp-password'), false);
});

test('apply executes the initial migration once in a transaction and verifies redirects', async () => {
  let migrated = false; let auth = { ...baseAuth }; const mutations: string[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url).endsWith('/database/query')) {
      const body = JSON.parse(String(init?.body));
      if (body.read_only) return Response.json([{ tables: migrated ? tables : [], ready: migrated }]);
      assert.match(body.query, /^begin;\n/); assert.match(body.query, /commit;$/); assert.ok(body.query.includes('TEST MIGRATION'));
      migrated = true; mutations.push('migration'); return Response.json([]);
    }
    if (init?.method === 'PATCH') { const patch = JSON.parse(String(init.body)); assert.equal(patch.mailer_autoconfirm, undefined); auth = { ...auth, ...patch }; mutations.push('auth'); }
    return Response.json(auth);
  };
  const first = await setupSupabase({ env, apply: true, migration: 'TEST MIGRATION', fetcher });
  assert.equal(first.databaseReady, true); assert.equal(first.redirectsReady, true);
  await setupSupabase({ env, apply: true, migration: 'TEST MIGRATION', fetcher });
  assert.deepEqual(mutations, ['migration', 'auth']);
});

test('partial database schema stops before writing anything', async () => {
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url).endsWith('/database/query')) { assert.equal(JSON.parse(String(init?.body)).read_only, true); return Response.json([{ tables: ['profiles'], ready: false }]); }
    assert.equal(init?.method, 'GET'); return Response.json(baseAuth);
  };
  await assert.rejects(setupSupabase({ env, apply: true, migration: 'TEST', fetcher }), /Partial or conflicting schema/);
});

test('management errors do not echo sensitive response bodies', async () => {
  await assert.rejects(setupSupabase({ env, apply: true, migration: 'TEST', fetcher: async () => new Response('secret response data', { status: 403 }) }), (error: unknown) => error instanceof Error && error.message.includes('403') && !error.message.includes('secret response data'));
});
