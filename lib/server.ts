import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { applicationOrigin, isApplicationOrigin, supabaseConfig } from './config';

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function required(name: string) { const value = process.env[name]?.trim(); if (!value) throw new ApiError(503, 'This service is not configured.'); return value; }
export function appOrigin() { try { return applicationOrigin(process.env.APP_URL); } catch { throw new ApiError(503, 'Application URL is not configured.'); } }
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!isApplicationOrigin(origin, appOrigin())) throw new ApiError(403, 'Request origin is not allowed.');
}
export function authRequestOrigin(request: Request) {
  const origin = new URL(request.url).origin;
  if (!isApplicationOrigin(origin, appOrigin())) throw new ApiError(403, 'Open authentication on the configured application domain.');
  return origin;
}
const timedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) });
export async function supabase() {
  const jar = await cookies();
  const { url, publishableKey } = supabaseConfig();
  if (!url || !publishableKey || publishableKey.startsWith('sb_secret_')) throw new ApiError(503, 'Authentication is not configured. Set the Supabase URL and publishable key.');
  return createServerClient(url, publishableKey, {
    global: { fetch: timedFetch },
    cookies: { getAll: () => jar.getAll(), setAll: (entries: { name: string; value: string; options: CookieOptions }[]) => { for (const { name, value, options } of entries) jar.set(name, value, options); } },
  });
}
export function supabaseForResponse(request: Request, response: NextResponse) {
  const { url, publishableKey } = supabaseConfig();
  if (!url || !publishableKey || publishableKey.startsWith('sb_secret_')) throw new ApiError(503, 'Authentication is not configured. Set the Supabase URL and publishable key.');
  return createServerClient(url, publishableKey, {
    global: { fetch: timedFetch },
    cookies: {
      getAll: () => request.headers.get('cookie')?.split('; ').filter(Boolean).map(value => {
        const separator = value.indexOf('=');
        return { name: separator < 0 ? value : value.slice(0, separator), value: separator < 0 ? '' : value.slice(separator + 1) };
      }) ?? [],
      setAll: (entries: { name: string; value: string; options: CookieOptions }[]) => {
        for (const { name, value, options } of entries) response.cookies.set(name, value, options);
      },
    },
  });
}
export function admin() { const { url, secretKey } = supabaseConfig(); if (!url || !secretKey) throw new ApiError(503, 'Server-side services are not configured.'); return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: timedFetch } }); }
export async function identity() { const db = await supabase(); const { data, error } = await db.auth.getUser(); if (error || !data.user) throw new ApiError(401, 'Please sign in to continue.'); return { db, user: data.user }; }
export async function json<T>(request: Request, schema: ZodType<T>): Promise<T> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError(415, 'Expected JSON.');
  const text = await request.text(); if (text.length > 16000) throw new ApiError(413, 'Request is too large.');
  try { return schema.parse(JSON.parse(text)); } catch { throw new ApiError(400, 'Please check the request fields.'); }
}
export function response(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
export function route(handler: (request: Request, context?: any) => Promise<Response>) { return async (request: Request, context?: any) => { try { return await handler(request, context); } catch (error) { if (error instanceof ApiError) return response({ error: error.message }, error.status); if (error instanceof ZodError) return response({ error: 'Please check the request fields.' }, 400); if (error && typeof error === 'object' && ['PGRST205', '42P01', '42703'].includes(String((error as { code?: string }).code ?? ''))) return response({ error: 'The workspace database is not ready. Apply the latest Supabase migrations, then try again.' }, 503); if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' && error.status >= 400 && error.status < 600) return response({ error: error instanceof Error ? error.message : 'Request failed.' }, error.status); return response({ error: 'The request could not be completed. Please try again.' }, 500); } }; }
