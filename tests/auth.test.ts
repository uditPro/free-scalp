import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applicationOrigin, serviceStatus, supabaseConfig } from '../lib/config';
import { authSchema } from '../lib/validation';
import { AuthFlowError, completeAuthCallback, performAuth, publicAuthError } from '../lib/auth-flow';
import { readSession } from '../lib/session-state';

const callback = 'http://localhost:3000/api/auth/callback';
const email = 'test@example.com';
const signup = { action: 'signup' as const, email, password: 'test-password-only' };
type Auth = SupabaseClient['auth'];
function mockAuth(methods: Record<string, unknown>): Auth { return methods as unknown as Auth; }

test('modern Supabase environment names enable auth without an elevated secret', () => {
  const env = { APP_URL: 'http://localhost:3000', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
  assert.deepEqual(serviceStatus(env), { configured: false, auth: true, search: false, billing: false });
  assert.equal(supabaseConfig(env).secretKey, '');
  assert.equal(serviceStatus({ ...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not-public' }).auth, false);
  assert.equal(serviceStatus({ ...env, APP_URL: '' }).auth, false);
  assert.equal(serviceStatus({ ...env, SUPABASE_URL: 'invalid' }).auth, false);
});

test('legacy deployment keys remain compatible and blank modern keys fall back', () => {
  const env = { SUPABASE_URL: ' ', NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'legacy-public', SUPABASE_SERVICE_ROLE_KEY: 'legacy-server' };
  assert.deepEqual(supabaseConfig(env), { url: env.NEXT_PUBLIC_SUPABASE_URL, publishableKey: 'legacy-public', secretKey: 'legacy-server' });
});

test('canonical application origin rejects unsafe and malformed origins', () => {
  assert.equal(applicationOrigin('http://localhost:3000/'), 'http://localhost:3000');
  assert.equal(applicationOrigin('https://example.com'), 'https://example.com');
  for (const value of [undefined, '', 'http://example.com', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com?q=1', 'javascript:bad']) assert.throws(() => applicationOrigin(value));
});

test('auth schemas require only the appropriate fields per action', () => {
  for (const action of ['login', 'signup', 'reset', 'resend']) assert.equal(authSchema.safeParse({ action }).success, false);
  assert.equal(authSchema.safeParse({ action: 'login', email, password: '123456' }).success, true, 'existing six-character passwords can still log in');
  assert.equal(authSchema.safeParse({ ...signup, password: '123456' }).success, false);
  assert.equal(authSchema.safeParse({ ...signup, plan: 'pro' }).success, false);
  assert.equal(authSchema.safeParse({ action: 'logout' }).success, true);
  assert.equal(authSchema.safeParse({ action: 'update-password' }).success, false);
});

test('signup returns confirmation-required state without exposing Supabase user or session', async () => {
  const auth = mockAuth({ signUp: async (input: unknown) => {
    assert.deepEqual(input, { email, password: signup.password, options: { emailRedirectTo: callback } });
    return { data: { user: { id: 'private-id' }, session: null }, error: null };
  } });
  const result = await performAuth(signup, auth, callback);
  assert.equal(result.authenticated, false);
  assert.equal('requiresEmailConfirmation' in result && result.requiresEmailConfirmation, true);
  assert.equal('user' in result, false); assert.equal('session' in result, false);
});

test('signup with email auto-confirm enabled opens an authenticated workspace', async () => {
  const auth = mockAuth({ signUp: async () => ({ data: { session: { access_token: 'test-only-token' } }, error: null }) });
  const result = await performAuth(signup, auth, callback);
  assert.equal(result.authenticated, true);
  assert.equal('requiresEmailConfirmation' in result && result.requiresEmailConfirmation, false);
  assert.equal(JSON.stringify(result).includes('test-only-token'), false);
});

test('login requires a session and reports unconfirmed accounts helpfully', async () => {
  const input = { ...signup, action: 'login' as const };
  await assert.rejects(performAuth(input, mockAuth({ signInWithPassword: async () => ({ data: {}, error: { code: 'email_not_confirmed' } }) }), callback), /confirm your email/);
  await assert.rejects(performAuth(input, mockAuth({ signInWithPassword: async () => ({ data: { session: null }, error: null }) }), callback), /session could not be created/);
  assert.equal((await performAuth(input, mockAuth({ signInWithPassword: async () => ({ data: { session: {} }, error: null }) }), callback)).authenticated, true);
});

test('recovery delivery failure is not falsely reported as success', async () => {
  await assert.rejects(performAuth({ action: 'reset', email }, mockAuth({ resetPasswordForEmail: async () => ({ error: { code: 'over_email_send_rate_limit' } }) }), callback), (error: unknown) => error instanceof AuthFlowError && error.status === 429);
  const result = await performAuth({ action: 'reset', email }, mockAuth({ resetPasswordForEmail: async (_email: string, options: unknown) => { assert.deepEqual(options, { redirectTo: callback + '?next=recovery' }); return { error: { code: 'user_not_found' } }; } }), callback);
  assert.equal(result.ok, true);
});

test('resend uses the configured confirmation callback without revealing account existence', async () => {
  const result = await performAuth({ action: 'resend', email }, mockAuth({ resend: async (input: unknown) => {
    assert.deepEqual(input, { type: 'signup', email, options: { emailRedirectTo: callback } });
    return { error: null };
  } }), callback);
  assert.equal(result.message, 'If this account needs confirmation, a new email will be sent.');
});

test('password updates require a verified user', async () => {
  await assert.rejects(performAuth({ action: 'update-password', password: signup.password }, mockAuth({ getUser: async () => ({ data: { user: null }, error: null }) }), callback), (error: unknown) => error instanceof AuthFlowError && error.status === 401);
});

test('logout invalidates this session', async () => {
  const result = await performAuth({ action: 'logout' }, mockAuth({ signOut: async (options: unknown) => { assert.deepEqual(options, { scope: 'local' }); return { error: null }; } }), callback);
  assert.equal(result.authenticated, false);
});

test('auth callback supports PKCE and strictly limits redirect destinations', async () => {
  const auth = mockAuth({ exchangeCodeForSession: async (code: string) => { assert.equal(code, 'test-code'); return { error: null }; } });
  assert.equal(await completeAuthCallback(new URL(callback + '?code=test-code'), auth), '/dashboard');
  assert.equal(await completeAuthCallback(new URL(callback + '?code=test-code&next=recovery'), auth), '/reset-password');
  assert.equal(await completeAuthCallback(new URL(callback + '?code=test-code&next=https://evil.example'), auth), '/dashboard');
  assert.equal(await completeAuthCallback(new URL(callback + '?error=expired'), auth), '/login?error=confirmation');
  assert.equal(await completeAuthCallback(new URL(callback + '?code=expired'), mockAuth({ exchangeCodeForSession: async () => ({ error: {} }) })), '/login?error=confirmation');
});

test('token-hash email links work without PKCE browser state and reject unsupported types', async () => {
  const auth = mockAuth({ verifyOtp: async (input: unknown) => { assert.deepEqual(input, { token_hash: 'test-hash', type: 'recovery' }); return { error: null }; } });
  assert.equal(await completeAuthCallback(new URL(callback + '?token_hash=test-hash&type=recovery'), auth), '/reset-password');
  assert.equal(await completeAuthCallback(new URL(callback + '?token_hash=test-hash&type=invite'), auth), '/login?error=confirmation');
});

function sessionClient(profile: { data: unknown; error: unknown }, user: { id: string; email: string } | null = { id: 'user-1', email }) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (table: string) => { assert.equal(table, 'profiles'); return { select: (column: string) => { assert.equal(column, 'plan'); return { eq: (column: string, id: string) => { assert.equal(column, 'id'); assert.equal(id, 'user-1'); return { maybeSingle: async () => profile }; } }; } }; },
  } as unknown as SupabaseClient;
}

test('missing application tables do not make a real login appear unauthenticated', async () => {
  const result = await readSession(sessionClient({ data: null, error: { code: 'PGRST205' } }));
  assert.equal(result.user?.email, email); assert.equal(result.profileReady, false); assert.equal(result.plan, 'unavailable');
  assert.match(result.setupMessage ?? '', /migrations/);
});

test('verified session reads the tenant profile and unauthenticated sessions skip profile access', async () => {
  const result = await readSession(sessionClient({ data: { plan: 'pro' }, error: null }));
  assert.equal(result.plan, 'pro'); assert.equal(result.profileReady, true);
  assert.equal((await readSession(sessionClient({ data: null, error: null }, null))).user, null);
});

test('public auth errors are actionable without leaking provider details', () => {
  assert.equal(publicAuthError({ code: 'email_address_not_authorized' }, 'Failed').status, 503);
  assert.equal(publicAuthError({ status: 503 }, 'Failed').status, 503);
  assert.equal(publicAuthError({ code: 'invalid_credentials' }, 'Invalid credentials').message, 'Invalid credentials');
});
