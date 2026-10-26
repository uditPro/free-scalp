import { employerJobSchema } from '@/lib/validation';
import { admin, checkOrigin, identity, json, response, route, ApiError } from '@/lib/server';

async function ownedCompany(userId: string) {
  const { data, error } = await admin().from('employer_companies').select('*').eq('owner_user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export const GET = route(async () => {
  const { user } = await identity();
  const company = await ownedCompany(user.id);
  if (!company) return response({ company: null, jobs: [] });
  const db = admin();
   const { data: jobs, error } = await db.from('employer_jobs').select('*').eq('company_id', company.id).order('created_at', { ascending: false });
   if (error) throw error;
   const ids = (jobs ?? []).map(job => job.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: applications, error: applicationError } = await db.from('employer_applications').select('job_id').in('job_id', ids);
    if (applicationError) throw applicationError;
    for (const application of applications ?? []) counts.set(application.job_id, (counts.get(application.job_id) ?? 0) + 1);
  }
   const { data: promotions, error: promotionError } = ids.length ? await db.from('employer_job_promotions').select('*').in('job_id', ids) : { data: [], error: null };
   if (promotionError) throw promotionError;
   const promotionMap = new Map((promotions ?? []).map(promotion => [promotion.job_id, promotion]));
   const { data: activePromotions, error: activePromotionError } = await db.from('employer_job_promotions').select('job_id,current_bid_cents,last_payment_at').eq('status', 'active').order('current_bid_cents', { ascending: false }).order('last_payment_at', { ascending: true });
   if (activePromotionError) throw activePromotionError;
   const activeRankMap = new Map((activePromotions ?? []).map((promotion, index) => [promotion.job_id, index + 1]));
   const highestBidCents = Math.max(0, ...(activePromotions ?? []).map(promotion => Number(promotion.current_bid_cents ?? 0)));
   return response({ company, highestBidCents, jobs: (jobs ?? []).map(job => { const promotion = promotionMap.get(job.id); const ownBid = Number(promotion?.current_bid_cents ?? 0); return { ...job, applicant_count: counts.get(job.id) ?? 0, promotion: promotion ? { ...promotion, rank: activeRankMap.get(job.id) ?? null, minimum_next_bid_cents: Math.max(100, ownBid + 100, highestBidCents + (activeRankMap.get(job.id) === 1 ? 100 : 100)) } : null, highest_bid_cents: highestBidCents }; }) });
 });

export const POST = route(async request => {
  checkOrigin(request);
  const input = await json(request, employerJobSchema);
  const { user } = await identity();
  const company = await ownedCompany(user.id);
  if (!company) throw new ApiError(400, 'Create your company profile before posting a job.');
  if (company.verification_status !== 'verified') throw new ApiError(403, 'Verify your company with a matching business email before posting a free job.');
  const { data, error } = await admin().from('employer_jobs').insert({ company_id: company.id, ...input, status: 'draft' }).select('*').single();
  if (error) throw error;
  return response({ job: data }, 201);
});
