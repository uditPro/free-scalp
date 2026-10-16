import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import type { authSchema } from './validation';

type Auth = SupabaseClient['auth'];
type AuthError = { code?: string; status?: number };
export class AuthFlowError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Never return provider payloads, tokens, or raw errors to the browser.
export function publicAuthError(error: AuthError, fallback: string) {
  if (error.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error.code ?? '')) return new AuthFlowError(429, 'Too many attempts. Please wait a few minutes before trying again.');
  if (error.code === 'email_not_confirmed') return new AuthFlowError(400, 'Please confirm your email before signing in. Check your inbox or request a new confirmation email.');
  if (error.code === 'signup_disabled') return new AuthFlowError(503, 'New signups are disabled for this workspace. Contact the workspace operator.');
  if (error.code === 'email_address_not_authorized') return new AuthFlowError(503, 'Email delivery is not configured for this address. The workspace operator must configure Supabase SMTP.');
  if (error.code === 'weak_password') return new AuthFlowError(400, 'Choose a stronger password that meets this workspace’s password policy.');
  if (error.code === 'same_password') return new AuthFlowError(400, 'Choose a password different from your current one.');
  if (error.code === 'captcha_failed') return new AuthFlowError(503, 'This workspace requires a CAPTCHA that is not configured in this app. Contact the workspace operator.');
  if (error.status && error.status >= 500) return new AuthFlowError(503, 'Authentication is temporarily unavailable. Please try again later.');
  return new AuthFlowError(400, fallback);
}

export async function performAuth(input: z.infer<typeof authSchema>, auth: Auth, callback: string) {
  switch (input.action) {
    case 'oauth': {
      // Keep this URL exactly equal to the Supabase allow-list entry. The
      // provider returns the PKCE code to this same hostname.
      const { data, error } = await auth.signInWithOAuth({ provider: input.provider, options: { redirectTo: callback, skipBrowserRedirect: true } });
      if (error || !data.url) throw publicAuthError(error ?? { status: 503 }, 'Google sign-in is temporarily unavailable. Please try again later.');
      return { ok: true, redirectTo: data.url };
    }
    case 'logout': {
      const { error } = await auth.signOut({ scope: 'local' });
      if (error) throw publicAuthError(error, 'Could not sign out. Please try again.');
      return { ok: true, authenticated: false };
    }
    case 'update-password': {
      const { data, error: sessionError } = await auth.getUser();
      if (sessionError || !data.user) throw new AuthFlowError(401, 'Open a valid recovery link first.');
      const { error } = await auth.updateUser({ password: input.password });
      if (error) throw publicAuthError(error, 'Password could not be updated. Please try again.');
      return { ok: true, authenticated: true };
    }
    case 'reset': {
      const { error } = await auth.resetPasswordForEmail(input.email, { redirectTo: `${callback}?next=recovery` });
      // Unknown addresses get the same response; delivery/configuration errors
      // must not be falsely reported as a successfully sent recovery email.
      if (error && error.code !== 'user_not_found') throw publicAuthError(error, 'The recovery email could not be sent. Please try again later.');
      return { ok: true, message: 'If an account exists, a recovery email will be sent.' };
    }
    case 'resend': {
      const { error } = await auth.resend({ type: 'signup', email: input.email, options: { emailRedirectTo: callback } });
      if (error && error.code !== 'user_not_found') throw publicAuthError(error, 'The confirmation email could not be sent. Please try again later.');
      return { ok: true, message: 'If this account needs confirmation, a new email will be sent.' };
    }
    case 'login': {
      const { data, error } = await auth.signInWithPassword({ email: input.email, password: input.password });
      if (error) throw publicAuthError(error, 'Unable to sign in with these credentials.');
      if (!data.session) throw new AuthFlowError(401, 'A session could not be created. Please try signing in again.');
      return { ok: true, authenticated: true };
    }
    case 'signup': {
      const { data, error } = await auth.signUp({ email: input.email, password: input.password, options: { emailRedirectTo: callback } });
      if (error) throw publicAuthError(error, 'Unable to create an account. Try signing in or resetting your password if you already have an account.');
      // Supabase returns a session immediately when email confirmation is off.
      return { ok: true, authenticated: !!data.session, requiresEmailConfirmation: !data.session, userId: data.user?.id, message: data.session ? 'Your account is ready.' : 'Check your email to confirm your account.' };
    }
  }
}

export async function completeAuthCallback(url: URL, auth: Auth) {
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const failure = url.searchParams.has('error') ? '/login?error=oauth' : '/login?error=confirmation';
  if (url.searchParams.has('error')) return failure;
  if (code) {
    const { error } = await auth.exchangeCodeForSession(code);
    if (error) return failure;
  } else if (tokenHash && (type === 'signup' || type === 'email' || type === 'recovery')) {
    const { error } = await auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return failure;
  } else return failure;
  // Never redirect to arbitrary user-provided URLs.
  return type === 'recovery' || url.searchParams.get('next') === 'recovery' ? '/reset-password' : '/dashboard';
}
