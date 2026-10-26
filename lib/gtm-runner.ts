import { discover } from './discovery';
import { googlePlacesSearch } from './google-places';
import { corroborateLeadResults, leadSearchQuery, normalizeLeads, type LeadSearchInput } from './lead-workflow';
import { deterministicOutreachDraft, leadEmail, sendOutreachEmail } from './outreach-agent';
import { ApiError } from './server';

type Db = ReturnType<typeof import('./server').admin>;
type Agent = { id: string; user_id: string; company_name: string; company_website: string; company_description: string; target_audience: string; system_enabled: boolean; autopilot_enabled: boolean; min_fit_score: number; daily_limit: number; from_email: string; reply_to: string; };
type Brief = { id: string; user_id: string; name: string; audience: string; problem: string; location: string; sources: string[]; active: boolean; };

export async function runBriefDiscovery(db: Db, userId: string, agent: Agent, brief: Brief, trigger: 'manual' | 'cron' | 'autopilot' = 'manual') {
  const { data: run, error: runError } = await db.from('gtm_agent_runs').insert({ user_id: userId, trigger, status: 'running' }).select('id').single();
  if (runError) throw runError;
  let searchRunId: string | null = null;
  try {
    const input: LeadSearchInput = { niche: brief.audience, need: brief.problem || agent.target_audience, location: brief.location || undefined, sources: brief.sources, contactPreference: 'email', limit: 50 };
    const query = leadSearchQuery(input).slice(0, 500);
    const { data: profile, error: profileError } = await db.from('profiles').select('plan').eq('id', userId).single();
    if (profileError || !profile) throw new Error('Your workspace profile is not ready.');
    const searchLimit = profile.plan === 'pro' ? 100 : profile.plan === 'starter' ? 50 : 10;
    const filters = brief.location ? { location: brief.location } : {};
    const { data: reservedSearchRunId, error: reservationError } = await db.rpc('reserve_filtered_run', { p_user: userId, p_query: query, p_kind: 'clients', p_limit: Math.min(searchLimit, 100), p_filters: filters });
    if (reservationError) {
      if (reservationError.message.includes('QUOTA_EXCEEDED')) throw new ApiError(429, 'Your monthly client-search limit has been reached. Upgrade your plan or wait for the next billing month.');
      if (reservationError.message.includes('PLAN_LIMIT')) throw new ApiError(403, 'Your current plan does not allow this discovery size or filter.');
      throw reservationError;
    }
    searchRunId = reservedSearchRunId;
    input.limit = searchLimit;
    const found = await discover(query, 'clients', process.env, { limit: searchLimit, detailed: profile.plan !== 'free', filters });
    const places = await googlePlacesSearch([input.niche, input.location].filter(Boolean).join(' '), { limit: 20 }, process.env).catch(() => ({ results: [] }));
    const leads = normalizeLeads(corroborateLeadResults(found.results, places.results), input);
    if (leads.length) {
      const { error } = await db.from('leads').upsert(leads.map(lead => ({ user_id: userId, canonical_key: lead.canonicalKey, business_name: lead.businessName, domain: lead.domain, source_url: lead.sourceUrl, source_title: lead.sourceTitle, source_domain: lead.sourceDomain, description: lead.description, location: lead.location ?? null, contact_name: lead.contactName ?? null, industry: lead.industry ?? null, need_signal: lead.needSignal ?? null, public_contacts: lead.publicContacts, evidence: lead.evidence, confidence: lead.confidence, provenance: lead.provenance, quality_score: lead.qualityScore, score: lead.score, score_explanation: lead.explanation })), { onConflict: 'user_id,canonical_key' });
      if (error) throw error;
    }
    await db.from('gtm_briefs').update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', brief.id).eq('user_id', userId);
    await db.from('gtm_agents').update({ last_discovery_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('user_id', userId);
    await db.from('runs').update({ status: 'completed', results: found.results, result_count: found.results.length }).eq('id', searchRunId).eq('user_id', userId);
    await db.from('gtm_agent_runs').update({ status: 'completed', leads_found: leads.length, completed_at: new Date().toISOString() }).eq('id', run.id).eq('user_id', userId);
    return { runId: run.id, leadsFound: leads.length, warnings: found.warnings };
  } catch (error) {
    if (searchRunId) await db.from('runs').update({ status: 'failed', result_count: 0, results: [] }).eq('id', searchRunId).eq('user_id', userId);
    await db.from('gtm_agent_runs').update({ status: 'failed', error: error instanceof Error ? error.message : 'Discovery failed.', completed_at: new Date().toISOString() }).eq('id', run.id).eq('user_id', userId);
    throw error;
  }
}

export async function createDraftMessages(db: Db, userId: string, campaignId: string, limit: number) {
  const { data: campaign, error: campaignError } = await db.from('gtm_campaigns').select('*').eq('id', campaignId).eq('user_id', userId).maybeSingle();
  if (campaignError) throw campaignError;
  if (!campaign) throw new Error('Campaign not found.');
  const { data: leads, error: leadsError } = await db.from('leads').select('*').eq('user_id', userId).gte('score', 50).gte('quality_score', 50).not('need_signal', 'is', null).order('score', { ascending: false }).limit(limit);
  if (leadsError) throw leadsError;
  let created = 0;
  for (const lead of leads ?? []) {
    const email = leadEmail(lead);
    if (!email) continue;
    const existing = await db.from('gtm_outreach_messages').select('id').eq('lead_id', lead.id).eq('campaign_id', campaignId).eq('step', 0).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) continue;
    const draft = deterministicOutreachDraft(lead, campaign);
    const { error } = await db.from('gtm_outreach_messages').insert({ user_id: userId, lead_id: lead.id, campaign_id: campaignId, step: 0, recipient_email: email, subject: draft.subject, body: draft.body, status: 'draft' });
    if (error) throw error;
    created += 1;
  }
  return created;
}

export async function sendApprovedMessage(db: Db, userId: string, messageId: string) {
  const { data: message, error } = await db.from('gtm_outreach_messages').select('*').eq('id', messageId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!message) throw new Error('Message not found.');
  if ((message.status !== 'approved' && message.status !== 'queued') || !message.approved_at) throw new Error('Approve the message before sending.');
  const { data: agent, error: agentError } = await db.from('gtm_agents').select('*').eq('user_id', userId).maybeSingle();
  if (agentError) throw agentError;
  if (!agent?.system_enabled) throw new Error('The outreach system is paused. Turn it on before sending.');
  const from = agent.from_email || process.env.OUTREACH_FROM_EMAIL?.trim();
  if (!from) throw new Error('Email sending is not configured. Add a verified from address.');
  const credit = await db.rpc('reserve_gtm_email_credit', { p_user: userId });
  if (credit.error) {
    if (credit.error.message.includes('GTM_CREDITS_EXHAUSTED')) throw new Error('Outreach credits are exhausted. Upgrade your plan or add credits before sending.');
    throw credit.error;
  }
  try {
    const providerId = await sendOutreachEmail({ to: message.recipient_email, from, replyTo: agent.reply_to || process.env.OUTREACH_REPLY_TO?.trim() || undefined, subject: message.subject, text: message.body });
    await db.from('gtm_outreach_messages').update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: providerId, error: null, updated_at: new Date().toISOString() }).eq('id', message.id).eq('user_id', userId);
    return providerId;
  } catch (error) {
    const reserved = (credit.data ?? {}) as { welcome_cents?: number; plan_cents?: number };
    await db.rpc('refund_gtm_email_credit', {
      p_user: userId,
      p_welcome_cents: reserved.welcome_cents ?? 0,
      p_plan_cents: reserved.plan_cents ?? 0,
    });
    await db.from('gtm_outreach_messages').update({ status: 'failed', error: error instanceof Error ? error.message : 'Email failed.', updated_at: new Date().toISOString() }).eq('id', message.id).eq('user_id', userId);
    throw error;
  }
}
