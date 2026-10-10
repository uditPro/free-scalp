import { NextResponse } from 'next/server';
import { supabaseForResponse, authRequestOrigin, route } from '@/lib/server';
import { completeAuthCallback } from '@/lib/auth-flow';
export const GET = route(async request => {
  const origin = authRequestOrigin(request);
  // Create the redirect response before exchanging the PKCE code so Supabase
  // can attach refreshed auth cookies to the exact response the browser gets.
  const response = NextResponse.redirect(`${origin}/login?error=confirmation`);
  const db = supabaseForResponse(request, response);
  const path = await completeAuthCallback(new URL(request.url), db.auth);
  response.headers.set('Location', `${origin}${path}`);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
});
