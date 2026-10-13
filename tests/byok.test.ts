import assert from 'node:assert/strict';
import { byokSettingsSchema, isAllowedByokUrl } from '../lib/validation';

assert.equal(isAllowedByokUrl('https://api.openai.com/v1'), true);
assert.equal(isAllowedByokUrl('https://example.com:8443/v1'), false);
assert.equal(isAllowedByokUrl('http://localhost:1234/v1', { APP_ENV: 'development' }), true);
assert.equal(isAllowedByokUrl('http://localhost:1234/v1', { APP_ENV: 'production' }), false);
for (const url of ['http://example.com', 'https://127.0.0.1', 'https://192.168.1.5', 'https://service.local', 'https://user:pass@example.com']) assert.equal(isAllowedByokUrl(url, { APP_ENV: 'production' }), false);
assert.equal(byokSettingsSchema.safeParse({ provider: 'openai-compatible', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', apiKey: 'secret' }).success, true);
assert.equal(byokSettingsSchema.safeParse({ provider: 'other', model: 'x', baseUrl: 'https://example.com', apiKey: 'secret' }).success, false);
console.log('BYOK validation tests passed.');
