import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeJobFit, assertOwned, profileCompletion } from '../lib/candidate-workflow';
import { deterministicDrafts, aiStatus, generateDrafts } from '../lib/ai-adapter';
import { profileSchema, jobResultSchema } from '../lib/validation';

test('job fit is deterministic and explainable', () => {
  const fit = analyzeJobFit({ skills: ['TypeScript', 'React'], preferences: { titles: ['Engineer'], locations: ['Remote'] } }, { title: 'Frontend Engineer', description: 'Build React and TypeScript products', location: 'Remote' });
  assert.equal(fit.score, 100); assert.deepEqual(fit.explanation.matchedSkills, ['react', 'typescript']); assert.deepEqual(fit.explanation.components, { skills: 100, title: 100, location: 100 });
});
test('ownership helper rejects another user without leaking existence', () => { assert.throws(() => assertOwned({ user_id: 'owner' }, 'other'), /Resource not found/); assert.deepEqual(assertOwned({ user_id: 'owner', id: 1 }, 'owner'), { user_id: 'owner', id: 1 }); });
test('workflow schemas bound and reject unknown fields', () => { assert.equal(profileSchema.safeParse({ fullName: 'A', unexpected: true }).success, false); assert.equal(jobResultSchema.safeParse({ title: 'Role', description: 'Details' }).success, true); assert.equal(jobResultSchema.safeParse({ title: 'Role', description: 'Details', url: 'javascript:alert(1)' }).success, false); });
test('AI falls back to deterministic drafts and never needs a key', async () => { const old = { base: process.env.AI_MANAGED_BASE_URL, model: process.env.AI_MANAGED_MODEL, key: process.env.AI_MANAGED_API_KEY }; delete process.env.AI_MANAGED_BASE_URL; delete process.env.AI_MANAGED_MODEL; delete process.env.AI_MANAGED_API_KEY; try { assert.deepEqual(aiStatus(), { enabled: false, mode: 'deterministic' }); const result = await generateDrafts({ fullName: 'Ada', skills: ['TypeScript'] }, { title: 'Engineer', description: 'Build things' }); assert.equal(result.mode, 'deterministic'); assert.equal(result.coverLetter.includes('Ada'), true); assert.deepEqual(result, { ...deterministicDrafts({ fullName: 'Ada', skills: ['TypeScript'] }, { title: 'Engineer', description: 'Build things' }), mode: 'deterministic' }); } finally { if (old.base) process.env.AI_MANAGED_BASE_URL = old.base; if (old.model) process.env.AI_MANAGED_MODEL = old.model; if (old.key) process.env.AI_MANAGED_API_KEY = old.key; } });
test('profile completion exposes missing fields', () => { assert.deepEqual(profileCompletion({ fullName: 'Ada' }), { score: 17, missing: ['headline','skills','experience','resume','preferences'] }); });
