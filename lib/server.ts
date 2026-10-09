import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { applicationOrigin, supabaseConfig } from './config';

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function required(name: string) { const value = process.env[name]?.trim(); if (!value) throw new ApiError(503, 'This service is not configured.'); return value; }
export function appOrigin() { try { return applicationOrigin(process.env.APP_URL); } catch { throw new ApiError(503, 'Application URL is not configured.'); } }
export function checkOrigin(request: Request) { if (request.headers.get('origin') !== appOrigin()) throw new ApiError(403, 'Request origin is not allowed.'); }
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
export function admin() { const { url, secretKey } = supabaseConfig(); if (!url || !secretKey) throw new ApiError(503, 'Server-side services are not configured.'); return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: timedFetch } }); }
export async function identity() { const db = await supabase(); const { data, error } = await db.auth.getUser(); if (error || !data.user) throw new ApiError(401, 'Please sign in to continue.'); return { db, user: data.user }; }
export async function json<T>(request: Request, schema: ZodType<T>): Promise<T> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError(415, 'Expected JSON.');
  const text = await request.text(); if (text.length > 16000) throw new ApiError(413, 'Request is too large.');
  try { return schema.parse(JSON.parse(text)); } catch { throw new ApiError(400, 'Please check the request fields.'); }
}
export function response(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
export function route(handler: (request: Request) => Promise<Response>) { return async (request: Request) => { try { return await handler(request); } catch (error) { if (error instanceof ApiError) return response({ error: error.message }, error.status); if (error instanceof ZodError) return response({ error: 'Please check the request fields.' }, 400); return response({ error: 'The request could not be completed. Please try again.' }, 500); } }; }
