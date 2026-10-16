import 'server-only';
import { randomBytes } from 'node:crypto';
import { admin, ApiError } from './server';
import { affiliateCodePattern } from './affiliate-validation';
export { affiliateCodePattern } from './affiliate-validation';
export { parseReferralCookie } from './affiliate-validation';
export const REFERRAL_COOKIE = 'reachflow_referral';
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function newCode() { return randomBytes(12).toString('base64url'); }

export async function ensureAffiliateCode(userId: string) {
  const db = admin();
  const existing = await db.from('affiliate_codes').select('code, active').eq('user_id', userId).maybeSingle();
  if (existing.error) throw new ApiError(503, 'Affiliate setup is not available until the database migration is applied.');
  if (existing.data) return existing.data;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const created = await db.from('affiliate_codes').insert({ user_id: userId, code: newCode() }).select('code, active').single();
    if (!created.error && created.data) return created.data;
    if (created.error?.code !== '23505') break;
  }
  throw new ApiError(503, 'Your referral link could not be created. Please try again.');
}

export async function attributeSignup(userId: string, code: string | undefined, clickId: string | undefined) {
  if (!code || !affiliateCodePattern.test(code)) return;
  try {
    await admin().rpc('attribute_affiliate_signup', { p_code: code, p_referred_user: userId, p_click: clickId ?? null });
  } catch {
    // Attribution must never block account creation.
  }
}

export async function affiliateDashboard(userId: string) {
  const db = admin();
  const code = await ensureAffiliateCode(userId);
  const codeRow = await db.from('affiliate_codes').select('id').eq('user_id', userId).single();
  if (codeRow.error || !codeRow.data) throw new ApiError(503, 'Affiliate setup is not available until the database migration is applied.');
  const [clicks, attributions] = await Promise.all([
    db.from('affiliate_clicks').select('id', { count: 'exact', head: true }).eq('affiliate_code_id', codeRow.data.id),
    db.from('affiliate_attributions').select('id', { count: 'exact', head: true }).eq('affiliate_code_id', codeRow.data.id),
  ]);
  return { code: code.code, active: code.active, clicks: clicks.count ?? 0, signups: attributions.count ?? 0 };
}
