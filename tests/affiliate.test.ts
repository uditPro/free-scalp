import assert from 'node:assert/strict';
import { test } from 'node:test';
import { affiliateCodePattern, parseReferralCookie, referralCookieValue } from '../lib/affiliate-validation';

test('referral codes are opaque bounded identifiers', () => {
  assert.equal(affiliateCodePattern.test('a'.repeat(12)), true);
  assert.equal(affiliateCodePattern.test('short'), false);
  assert.equal(affiliateCodePattern.test('a'.repeat(65)), false);
  assert.equal(affiliateCodePattern.test('code with spaces'), false);
});

test('referral cookies accept only validated code and click fields', () => {
  const value = encodeURIComponent(JSON.stringify({ code: 'A'.repeat(12), clickId: '00000000-0000-0000-0000-000000000000' }));
  assert.deepEqual(parseReferralCookie(value), { code: 'A'.repeat(12), clickId: '00000000-0000-0000-0000-000000000000' });
  assert.equal(parseReferralCookie(encodeURIComponent(JSON.stringify({ code: 'unsafe code', clickId: 'not-an-id' }))), undefined);
  assert.equal(parseReferralCookie('%7Bmalformed'), undefined);
});

test('referral cookie extraction tolerates normal cookie formatting', () => {
  const value = encodeURIComponent(JSON.stringify({ code: 'A'.repeat(12) }));
  assert.equal(referralCookieValue(`session=x;reachflow_referral=${value}; theme=light`), value);
  assert.equal(referralCookieValue('session=x'), undefined);
});
