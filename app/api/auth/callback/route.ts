import { NextResponse } from 'next/server';
import { supabase, appOrigin, route } from '@/lib/server';
import { completeAuthCallback } from '@/lib/auth-flow';
export const GET = route(async request => {
  const db = await supabase();
  const path = await completeAuthCallback(new URL(request.url), db.auth);
  const response = NextResponse.redirect(`${appOrigin()}${path}`);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
});
