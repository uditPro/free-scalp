import { jobPromotionSchema } from '@/lib/validation';
import { admin, appOrigin, checkOrigin, identity, json, response, route, ApiError } from '@/lib/server';
import { stripe } from '@/lib/billing';

type Ctx = { params: Promise<{ id: string }> };

async function ownedPublishedJob(userId: string, id: string) {
  const db = admin();
  const { data: company, error: companyError } = await db.from('employer_companies').select('id,name,verification_status').eq('owner_user_id', userId).maybeSingle();
  if (companyError) throw companyError;
  if (!company || company.verification_status !== 'verified') throw new ApiError(403, 'Verify your company before promoting a job.');
  const { data: job, error } = await db.from('employer_jobs').select('id,title,status,company_id').eq('id', id).eq('company_id', company.id).maybeSingle();
  if (error) throw error;
  if (!job || job.status !== 'published') throw new ApiError(400, 'Only a published job can be promoted.');
  return { db, company, job };
}

export const GET = route(async (_request: Request, context?: Ctx) => {
  const { user } = await identity();
  const { db, job } = await ownedPublishedJob(user.id, (await context!.params).id);
  const { data: promotion, error } = await db.from('employer_job_promotions').select('*').eq('job_id', job.id).maybeSingle();
  if (error) throw error;
  const { data: highest, error: highestError } = await db.from('employer_job_promotions').select('current_bid_cents').eq('status', 'active').order('current_bid_cents', { ascending: false }).limit(1).maybeSingle();
  if (highestError) throw highestError;
  return response({ promotion, highestBidCents: highest?.current_bid_cents ?? 0 });
});

export const POST = route(async (request: Request, context?: Ctx) => {
  checkOrigin(request);
  const input = await json(request, jobPromotionSchema);
  const { user } = await identity();
  const { db, company, job } = await ownedPublishedJob(user.id, (await context!.params).id);
  const existing = await db.from('employer_job_promotions').select('*').eq('job_id', job.id).maybeSingle();
  if (existing.error) throw existing.error;
  const current = Number(existing.data?.current_bid_cents ?? 0);
  const { data: activeBids, error: activeBidError } = await db.from('employer_job_promotions').select('job_id,current_bid_cents').eq('status', 'active');
  if (activeBidError) throw activeBidError;
  const highestOtherBid = Math.max(0, ...(activeBids ?? []).filter(bid => bid.job_id !== job.id).map(bid => Number(bid.current_bid_cents ?? 0)));
  const minimumTarget = Math.max(100, current + 100, highestOtherBid + 100);
  if (input.targetCents < minimumTarget) throw new ApiError(400, `To enter or improve the auction, bid at least $${(minimumTarget / 100).toFixed(2)}. The current top bid is $${(Math.max(current, highestOtherBid) / 100).toFixed(2)}.`);
  const contribution = input.targetCents - current;
  let promotion = existing.data;
  if (!promotion) {
    const created = await db.from('employer_job_promotions').insert({ job_id: job.id, owner_user_id: user.id }).select('*').single();
    if (created.error) throw created.error;
    promotion = created.data;
  }
  const client = stripe();
  const session = await client.checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email,
    client_reference_id: user.id,
    line_items: [{ price_data: { currency: 'usd', product_data: { name: `Promote: ${job.title}`, description: `Transparent sponsored placement for ${company.name} on ReachFlow.` }, unit_amount: contribution }, quantity: 1 }],
    metadata: { promotion_id: promotion.id, user_id: user.id, job_id: job.id, target_cents: String(input.targetCents) },
    payment_intent_data: { metadata: { promotion_id: promotion.id, user_id: user.id, job_id: job.id } },
    success_url: `${appOrigin()}/employer?promotion=success`,
    cancel_url: `${appOrigin()}/employer?promotion=cancelled`,
  });
  if (!session.url) throw new ApiError(503, 'Promotion checkout is unavailable.');
  return response({ url: session.url, promotionId: promotion.id, contributionCents: contribution });
});
