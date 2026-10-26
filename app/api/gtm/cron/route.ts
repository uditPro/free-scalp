import { admin, response, route, ApiError } from '@/lib/server';
import { createDraftMessages, runBriefDiscovery, sendApprovedMessage } from '@/lib/gtm-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async request => {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!secret || supplied !== secret) throw new ApiError(401, 'Invalid cron authorization.');
  const db = admin();
  const { data: agents, error } = await db.from('gtm_agents').select('*').eq('system_enabled', true).eq('autopilot_enabled', true);
  if (error) throw error;
  const results: Array<Record<string, unknown>> = [];
  for (const agent of agents ?? []) {
    const { data: briefs } = await db.from('gtm_briefs').select('*').eq('user_id', agent.user_id).eq('active', true).order('updated_at', { ascending: false }).limit(5);
    for (const brief of briefs ?? []) {
      const stale = !brief.last_run_at || Date.now() - new Date(brief.last_run_at).getTime() > 23 * 60 * 60 * 1000;
      if (stale) {
        try { results.push({ userId: agent.user_id, ...(await runBriefDiscovery(db, agent.user_id, agent, brief, 'autopilot')) }); } catch (error) { results.push({ userId: agent.user_id, error: error instanceof Error ? error.message : 'Discovery failed.' }); }
      }
    }
    const { data: campaigns } = await db.from('gtm_campaigns').select('id').eq('user_id', agent.user_id).eq('status', 'active');
    for (const campaign of campaigns ?? []) {
      try { await createDraftMessages(db, agent.user_id, campaign.id, agent.daily_limit); } catch { /* keep the next campaign alive */ }
    }
    const { data: approved } = await db.from('gtm_outreach_messages').select('id').eq('user_id', agent.user_id).eq('status', 'approved').or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`).limit(agent.daily_limit);
    let sent = 0;
    for (const message of approved ?? []) { try { await sendApprovedMessage(db, agent.user_id, message.id); sent += 1; } catch { /* message is marked failed by the sender */ } }
    results.push({ userId: agent.user_id, sent });
  }
  return response({ processed: agents?.length ?? 0, results });
});

// Vercel Cron invokes the route with GET. Keep POST available for local and
// external schedulers while sharing the same protected runner.
export const GET = POST;
