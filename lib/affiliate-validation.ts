export const affiliateCodePattern = /^[A-Za-z0-9_-]{12,64}$/;

export function referralCookieValue(header: string | null | undefined): string | undefined {
  return header?.split(';').map(part => part.trim()).find(part => part.startsWith('reachflow_referral='))?.slice('reachflow_referral='.length);
}

export function parseReferralCookie(value: string | undefined): { code: string; clickId?: string } | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as { code?: unknown; clickId?: unknown };
    if (typeof parsed.code !== 'string' || !affiliateCodePattern.test(parsed.code)) return undefined;
    return { code: parsed.code, ...(typeof parsed.clickId === 'string' && /^[0-9a-f-]{36}$/i.test(parsed.clickId) ? { clickId: parsed.clickId } : {}) };
  } catch { return undefined; }
}
