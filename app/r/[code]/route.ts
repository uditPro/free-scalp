import { NextResponse } from 'next/server';
import { admin } from '@/lib/server';
import { affiliateCodePattern } from '@/lib/affiliate-validation';
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE } from '@/lib/affiliate';

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const response = NextResponse.redirect(new URL('/signup', request.url));
  if (!affiliateCodePattern.test(code)) return response;
  try {
    const result = await admin().rpc('record_affiliate_click', { p_code: code });
    if (result.error || !result.data) return response;
    response.cookies.set(REFERRAL_COOKIE, JSON.stringify({ code, clickId: result.data }), { httpOnly: true, sameSite: 'lax', secure: new URL(request.url).protocol === 'https:', maxAge: REFERRAL_COOKIE_MAX_AGE, path: '/' });
  } catch { /* Keep the public redirect available if tracking is unavailable. */ }
  return response;
}
