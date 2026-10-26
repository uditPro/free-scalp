export type OutreachLead = {
  business_name: string;
  contact_name?: string | null;
  industry?: string | null;
  location?: string | null;
  need_signal?: string | null;
  source_url?: string | null;
  public_contacts?: { emails?: string[] } | null;
};

export type OutreachCampaign = {
  subject_template: string;
  body_template: string;
  followup_subject?: string;
  followup_body?: string;
};

export function renderOutreachTemplate(template: string, lead: OutreachLead) {
  const firstName = lead.contact_name?.trim()?.split(/\s+/)[0] || 'there';
  const values: Record<string, string> = {
    first_name: firstName,
    contact_name: lead.contact_name?.trim() || 'there',
    business_name: lead.business_name,
    company_name: lead.business_name,
    sender_name: process.env.OUTREACH_SENDER_NAME?.trim() || 'The ReachFlow team',
    industry: lead.industry || 'your work',
    location: lead.location || 'your area',
    need_signal: lead.need_signal || 'the opportunity we found',
    source_url: lead.source_url || '',
  };
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => values[key.toLowerCase()] ?? '');
}

export function deterministicOutreachDraft(lead: OutreachLead, campaign: OutreachCampaign) {
  const subject = renderOutreachTemplate(campaign.subject_template, lead).slice(0, 180);
  const body = renderOutreachTemplate(campaign.body_template, lead).slice(0, 8000);
  return { subject, body, followupSubject: renderOutreachTemplate(campaign.followup_subject || '', lead).slice(0, 180), followupBody: renderOutreachTemplate(campaign.followup_body || '', lead).slice(0, 8000), mode: 'deterministic' as const };
}

export function defaultOutreachCampaign(): OutreachCampaign {
  return {
    subject_template: '{{business_name}} × a practical idea',
    body_template: 'Hi {{first_name}},\n\nI came across {{business_name}} while researching {{industry}} businesses in {{location}}. The public source mentioned {{need_signal}}.\n\nI work with teams on a focused version of this problem and had one practical idea I could send over. Would it be useful if I shared it?\n\nBest,\n{{sender_name}}',
    followup_subject: 'Re: {{business_name}} × a practical idea',
    followup_body: 'Hi {{first_name}},\n\nJust following up once on the idea for {{business_name}}. If this is not a priority, no action needed.\n\nBest,\n{{sender_name}}',
  };
}

export function leadEmail(lead: OutreachLead) { return lead.public_contacts?.emails?.find(email => /@/.test(email))?.trim().toLowerCase() || null; }

export async function sendOutreachEmail(input: { to: string; from: string; replyTo?: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error('Email sending is not configured. Set RESEND_API_KEY.');
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: input.from, to: [input.to], reply_to: input.replyTo || undefined, subject: input.subject, text: input.text }), signal: AbortSignal.timeout(15000) });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok || !payload.id) throw new Error(payload.message || 'The email provider rejected the message.');
  return payload.id;
}
