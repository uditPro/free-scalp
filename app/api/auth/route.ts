import { authSchema } from '@/lib/validation';
import { supabase, checkOrigin, authRequestOrigin, json, response, route, ApiError } from '@/lib/server';
import { AuthFlowError, performAuth } from '@/lib/auth-flow';
import { attributeSignup, parseReferralCookie } from '@/lib/affiliate';
import { referralCookieValue } from '@/lib/affiliate-validation';
export const POST = route(async request => {
  checkOrigin(request); const input = await json(request, authSchema); const db = await supabase();
  // The PKCE verifier cookie belongs to this host, not the other www/apex alias.
  const callback = `${authRequestOrigin(request)}/api/auth/callback`;
  try {
    const result = await performAuth(input, db.auth, callback);
    if (input.action === 'signup' && 'userId' in result && result.userId) {
      const referral = parseReferralCookie(referralCookieValue(request.headers.get('cookie')));
      await attributeSignup(result.userId, referral?.code, referral?.clickId);
    }
    return response(result);
  }
  catch (error) { if (error instanceof AuthFlowError) throw new ApiError(error.status, error.message); throw error; }
});
