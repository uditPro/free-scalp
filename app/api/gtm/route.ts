import { admin, checkOrigin, identity, json, response, route, ApiError } from '@/lib/server';
import { gtmActionSchema } from '@/lib/gtm-validation';
import { createDraftMessages, runBriefDiscovery, sendApprovedMessage } from '@/lib/gtm-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function agentFor(db: ReturnType<typeof admin>, userId: string) {
  const { data, error } = await db.from('gtm_agents').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export const GET = route(async () => {
  const { user } = await identity();
  const db = admin();
  const { error: creditRefreshError } = await db.rpc('refresh_gtm_plan_credits', { p_user: user.id });
  if (creditRefreshError) throw creditRefreshError;
  const [agentResult, briefsResult, campaignsResult, messagesResult, runsResult, leadsResult, walletResult, sessionResult] = await Promise.all([
    db.from('gtm_agents').select('*').eq('user_id', user.id).maybeSingle(),
    db.from('gtm_briefs').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
    db.from('gtm_campaigns').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
    db.from('gtm_outreach_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
    db.from('gtm_agent_runs').select('*').eq('user_id', user.id).order('started_at', { ascending: false }).limit(12),
    db.from('leads').select('*').eq('user_id', user.id).gte('quality_score', 50).order('score', { ascending: false }).limit(50),
    db.from('gtm_credit_wallets').select('*').eq('user_id', user.id).maybeSingle(),
    db.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
  ]);
  for (const result of [agentResult, briefsResult, campaignsResult, messagesResult, runsResult, leadsResult, walletResult, sessionResult]) if (result.error) throw result.error;
  return response({ agent: agentResult.data, briefs: briefsResult.data ?? [], campaigns: campaignsResult.data ?? [], messages: messagesResult.data ?? [], runs: runsResult.data ?? [], leads: leadsResult.data ?? [], wallet: walletResult.data, plan: sessionResult.data?.plan ?? 'free' });
});

export const POST = route(async request => {
  checkOrigin(request);
  const input = await json(request, gtmActionSchema);
  const { user } = await identity();
  const db = admin();
  if (input.action === 'settings') {
    const { data, error } = await db.from('gtm_agents').upsert({ user_id: user.id, company_name: input.companyName, company_website: input.companyWebsite, company_description: input.companyDescription, target_audience: input.targetAudience, system_enabled: input.systemEnabled, autopilot_enabled: input.autopilotEnabled, min_fit_score: input.minFitScore, daily_limit: input.dailyLimit, from_email: input.fromEmail, reply_to: input.replyTo, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select('*').single();
    if (error) throw error;
    return response({ agent: data });
  }
  if (input.action === 'brief') {
    const { data, error } = await db.from('gtm_briefs').insert({ user_id: user.id, name: input.name, audience: input.audience, problem: input.problem, location: input.location, run_mode: input.runMode, sources: [] }).select('*').single();
    if (error) throw error;
    return response({ brief: data }, 201);
  }
  if (input.action === 'campaign') {
    const values = { user_id: user.id, name: input.name, status: input.status, subject_template: input.subjectTemplate, body_template: input.bodyTemplate, followup_subject: input.followupSubject, followup_body: input.followupBody, followup_delay_days: input.followupDelayDays, daily_limit: input.dailyLimit, updated_at: new Date().toISOString() };
    const query = input.id ? db.from('gtm_campaigns').update(values).eq('id', input.id).eq('user_id', user.id) : db.from('gtm_campaigns').insert(values);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return response({ campaign: data });
  }
  if (input.action === 'run') {
    const agent = await agentFor(db, user.id);
    if (!agent) throw new ApiError(400, 'Save your company context before running discovery.');
    const briefQuery = input.briefId ? db.from('gtm_briefs').select('*').eq('id', input.briefId).eq('user_id', user.id).maybeSingle() : db.from('gtm_briefs').select('*').eq('user_id', user.id).eq('active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const { data: brief, error } = await briefQuery;
    if (error) throw error;
    if (!brief) throw new ApiError(400, 'Create an active lead brief before running discovery.');
    const result = await runBriefDiscovery(db, user.id, agent, brief, 'manual');
    return response(result);
  }
  if (input.action === 'drafts') {
    const created = await createDraftMessages(db, user.id, input.campaignId, input.limit ?? 20);
    return response({ created });
  }
  if (input.action === 'approve') {
    const { data, error } = await db.from('gtm_outreach_messages').update({ status: 'approved', approved_at: new Date().toISOString(), scheduled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', input.messageId).eq('user_id', user.id).eq('status', 'draft').select('*').single();
    if (error || !data) throw new ApiError(400, 'Only a draft message can be approved.');
    return response({ message: data });
  }
  if (input.action === 'send') {
    const providerId = await sendApprovedMessage(db, user.id, input.messageId);
    return response({ sent: true, providerId });
  }
  if (input.action === 'pause') {
    const field = input.mode === 'system' ? 'system_enabled' : 'autopilot_enabled';
    const { data, error } = await db.from('gtm_agents').update({ [field]: input.value, updated_at: new Date().toISOString() }).eq('user_id', user.id).select('*').single();
    if (error) throw error;
    return response({ agent: data });
  }
  throw new ApiError(400, 'Unsupported agent action.');
});
