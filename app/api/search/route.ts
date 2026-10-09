import { searchSchema } from '@/lib/validation';
import { identity, admin, checkOrigin, json, response, route, ApiError } from '@/lib/server';
import { discover, discoveryProvider, DiscoveryError } from '@/lib/discovery';
import { authorizeSearch, SearchAccessError } from '@/lib/search-options';
export const maxDuration = 60;
export const POST = route(async request => {
  checkOrigin(request); const input = await json(request, searchSchema); const { user } = await identity(); const db = admin();
  const { data: profile, error: profileError } = await db.from('profiles').select('plan').eq('id', user.id).single();
  if (profileError || !profile) throw new ApiError(503, 'Your workspace profile is not ready.');
  let options;
  try { options = authorizeSearch(profile.plan, input); } catch (error) { if (error instanceof SearchAccessError) throw new ApiError(error.status, error.message); throw error; }
  try { discoveryProvider(); } catch (error) { if (error instanceof DiscoveryError) throw new ApiError(error.status, error.message); throw error; }
  const { data: runId, error } = options.detailed
    ? await db.rpc('reserve_filtered_run', { p_user: user.id, p_query: input.query, p_kind: input.kind, p_limit: options.limit, p_filters: options.filters })
    : await db.rpc('reserve_run', { p_user: user.id, p_query: input.query, p_kind: input.kind });
  if (error) {
    if (error.message.includes('QUOTA_EXCEEDED')) throw new ApiError(429, 'Your monthly search limit has been reached.');
    if (error.message.includes('PLAN_LIMIT')) throw new ApiError(403, 'Your plan changed. Refresh the workspace to see the current search allowance.');
    if (options.detailed && ['PGRST202', '42883'].includes(error.code)) throw new ApiError(503, 'Paid search upgrade needs database migration 002_paid_search_results_and_filters.sql. Your original migration is already separate; no search was charged.');
    throw new ApiError(503, 'Your workspace database is not ready. The workspace operator must finish Supabase setup.');
  }
  try {
    const { results, provider, warnings } = await discover(input.query, input.kind, process.env, options);
    const saved = await db.from('runs').update({ status: 'completed', results, result_count: results.length }).eq('id', runId).eq('user_id', user.id);
    if (saved.error) throw new Error('Persistence failure');
    return response({ results, runId, provider, warnings, limit: options.limit, plan: profile.plan });
  } catch (error) {
    await db.from('runs').update({ status: 'failed', result_count: 0, results: [] }).eq('id', runId).eq('user_id', user.id);
    if (error instanceof DiscoveryError) throw new ApiError(error.status, `${error.message} This attempt counts toward your monthly limit.`);
    throw new ApiError(502, 'Search could not be completed. This attempt counts toward your monthly limit. Please try again later.');
  }
});
