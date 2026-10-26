import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultOutreachCampaign, deterministicOutreachDraft, leadEmail, renderOutreachTemplate } from '../lib/outreach-agent';

const lead = { business_name: 'Acme Foods', contact_name: 'Asha Rao', industry: 'food distribution', location: 'Pune', need_signal: 'needs a new ordering website', public_contacts: { emails: ['asha@acme.example'] }, source_url: 'https://acme.example/contact' };

test('outreach templates use only supplied lead evidence', () => {
  assert.equal(renderOutreachTemplate('Hi {{first_name}} at {{business_name}} about {{need_signal}}.', lead), 'Hi Asha at Acme Foods about needs a new ordering website.');
  assert.equal(leadEmail(lead), 'asha@acme.example');
});

test('deterministic outreach drafts are bounded and reviewable', () => {
  const draft = deterministicOutreachDraft(lead, defaultOutreachCampaign());
  assert.equal(draft.mode, 'deterministic');
  assert.match(draft.subject, /Acme Foods/);
  assert.match(draft.body, /new ordering website/);
  assert.ok(draft.body.length <= 8000);
});
