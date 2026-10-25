import { employerBoardQuerySchema } from '@/lib/validation';
import { admin, response, route, ApiError } from '@/lib/server';

export const dynamic = 'force-dynamic';

export const GET = route(async request => {
  const parsed = employerBoardQuerySchema.safeParse({
    query: new URL(request.url).searchParams.get('query') || undefined,
    location: new URL(request.url).searchParams.get('location') || undefined,
    limit: new URL(request.url).searchParams.get('limit') || undefined,
  });
  if (!parsed.success) throw new ApiError(400, 'Please check the job search filters.');
  const { query, location, limit } = parsed.data;
  const db = admin();
  const { data: jobs, error } = await db.from('employer_jobs').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(100);
  if (error) throw error;
  const companyIds = [...new Set((jobs ?? []).map(job => job.company_id))];
  if (!companyIds.length) return response({ jobs: [] });
   const { data: companies, error: companyError } = await db.from('employer_companies').select('id,name,website_url,description,verification_status').in('id', companyIds).eq('verification_status', 'verified');
  if (companyError) throw companyError;
  const companyMap = new Map((companies ?? []).map(company => [company.id, company]));
  const normalizedQuery = query?.toLowerCase();
  const normalizedLocation = location?.toLowerCase();
   const { data: promotions, error: promotionError } = companyIds.length ? await db.from('employer_job_promotions').select('job_id,current_bid_cents,status,last_payment_at').in('job_id', (jobs ?? []).map(job => job.id)).eq('status', 'active') : { data: [], error: null };
   if (promotionError) throw promotionError;
   const promotionMap = new Map((promotions ?? []).map(promotion => [promotion.job_id, promotion]));
   const filtered = (jobs ?? []).filter(job => {
    const company = companyMap.get(job.company_id);
    if (!company) return false;
    const searchable = `${job.title} ${job.location} ${job.description} ${job.requirements} ${company.name}`.toLowerCase();
    return (!normalizedQuery || searchable.includes(normalizedQuery)) && (!normalizedLocation || job.location.toLowerCase().includes(normalizedLocation));
   }).sort((a, b) => {
     const aPromotion = promotionMap.get(a.id);
     const bPromotion = promotionMap.get(b.id);
     if (aPromotion && !bPromotion) return -1;
     if (!aPromotion && bPromotion) return 1;
     if (aPromotion && bPromotion && aPromotion.current_bid_cents !== bPromotion.current_bid_cents) return Number(bPromotion.current_bid_cents) - Number(aPromotion.current_bid_cents);
     return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
   }).slice(0, limit).map(job => {
     const company = companyMap.get(job.company_id)!;
     const promotion = promotionMap.get(job.id);
     return { ...job, is_sponsored: Boolean(promotion), promotion_label: promotion ? 'Sponsored placement' : null, company: { id: company.id, name: company.name, website_url: company.website_url, description: company.description, verified: true } };
  });
  return response({ jobs: filtered });
});
