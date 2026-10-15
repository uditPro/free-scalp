import { leadListSchema, leadSearchSchema } from '@/lib/validation';
import { admin, checkOrigin, identity, json, response, route, ApiError } from '@/lib/server';
import { discover, DiscoveryError } from '@/lib/discovery';
import { leadSearchQuery, leadsCsv, normalizeLeads } from '@/lib/lead-workflow';

export const maxDuration = 60;

export const POST = route(async request => {
  checkOrigin(request);
  const input = await json(request, leadSearchSchema);
  const { user } = await identity();
  const limit = input.limit ?? 20;
  try {
    const found = await discover(leadSearchQuery(input), 'clients', process.env, { limit, detailed: true, filters: input.location ? { location: input.location } : {} });
    const leads = normalizeLeads(found.results, input);
    const db = admin();
    if (leads.length) {
      const { error } = await db.from('leads').upsert(leads.map(lead => ({ user_id: user.id, canonical_key: lead.canonicalKey, business_name: lead.businessName, domain: lead.domain, source_url: lead.sourceUrl, description: lead.description, location: lead.location ?? null, public_contacts: lead.publicContacts, score: lead.score, score_explanation: lead.explanation })), { onConflict: 'user_id,canonical_key', ignoreDuplicates: true });
      if (error) throw new ApiError(503, 'The workspace database is not ready. Apply migration 005_leads_crm.sql.');
    }
    const keys = leads.map(lead => lead.canonicalKey);
    const { data, error } = keys.length ? await db.from('leads').select('*').eq('user_id', user.id).in('canonical_key', keys) : { data: [], error: null };
    if (error) throw new ApiError(503, 'The workspace database is not ready.');
    return response({ leads: data ?? [], provider: found.provider, warnings: [...found.warnings, 'Only business records and contacts explicitly present in public indexed source text are retained. No personal contact details are inferred.', 'Justdial and IndiaMART are treated only as Exa-indexed source labels; no direct scraping is performed.'] });
  } catch (error) {
    if (error instanceof DiscoveryError) throw new ApiError(error.status, error.message);
    throw error;
  }
});

export const GET = route(async request => {
  const { user } = await identity();
  const parsed = leadListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new ApiError(400, 'Please check the request fields.');
  const db = admin();
  let query = db.from('leads').select('*', { count: 'exact' }).eq('user_id', user.id).order('updated_at', { ascending: false }).range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);
  if (parsed.data.status) query = query.eq('status', parsed.data.status);
  const { data, count, error } = await query;
  if (error) throw new ApiError(503, 'The workspace database is not ready.');
  if (parsed.data.format === 'csv') return new Response(leadsCsv(data ?? []), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="leads.csv"', 'Cache-Control': 'no-store' } });
  return response({ leads: data ?? [], count: count ?? 0, limit: parsed.data.limit, offset: parsed.data.offset });
});
