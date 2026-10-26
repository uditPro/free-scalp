import { homepagePromotionSchema } from '@/lib/validation';
import { admin, appOrigin, checkOrigin, json, response, route, ApiError } from '@/lib/server';
import { stripe } from '@/lib/billing';

export const dynamic = 'force-dynamic';

function identityLabel(input: { websiteUrl?: string; xUsername?: string }) {
  if (input.websiteUrl) return new URL(input.websiteUrl).hostname.replace(/^www\./, '');
  return `@${input.xUsername!.replace(/^@/, '')}`;
}

export const GET = route(async () => {
  const { data, error } = await admin().from('homepage_promotions').select('id,website_url,x_username,current_bid_cents,last_payment_at').eq('status', 'active').order('current_bid_cents', { ascending: false }).order('last_payment_at', { ascending: true }).limit(20);
  if (error) throw error;
  return response({ promotions: (data ?? []).map((promotion, index) => ({ ...promotion, rank: index + 1, current_bid_cents: Number(promotion.current_bid_cents) })) });
});

export const POST = route(async request => {
  checkOrigin(request);
  const input = await json(request, homepagePromotionSchema);
  const db = admin();
  const { data: active, error: activeError } = await db.from('homepage_promotions').select('current_bid_cents').eq('status', 'active');
  if (activeError) throw activeError;
  const highestBidCents = Math.max(0, ...(active ?? []).map(promotion => Number(promotion.current_bid_cents ?? 0)));
  const minimumTargetCents = Math.max(100, highestBidCents + 100);
  if (input.targetCents < minimumTargetCents) throw new ApiError(400, `The current top bid is $${(highestBidCents / 100).toFixed(2)}. Bid at least $${(minimumTargetCents / 100).toFixed(2)} to enter.`);

  const { data: promotion, error: insertError } = await db.from('homepage_promotions').insert({ website_url: input.websiteUrl ?? null, x_username: input.xUsername?.replace(/^@/, '') ?? null, terms_accepted_at: new Date().toISOString(), terms_version: 'homepage-promotion-v1' }).select('id').single();
  if (insertError) throw insertError;
  const label = identityLabel(input);
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer_creation: 'always',
    line_items: [{ price_data: { currency: 'usd', product_data: { name: `Homepage sponsored placement: ${label}`, description: `Clearly labeled homepage visibility for ${label} on ReachFlow.` }, unit_amount: input.targetCents }, quantity: 1 }],
    metadata: { homepage_promotion_id: promotion.id, target_cents: String(input.targetCents), terms_version: 'homepage-promotion-v1' },
    payment_intent_data: { metadata: { homepage_promotion_id: promotion.id, target_cents: String(input.targetCents) } },
    success_url: `${appOrigin()}/?promotion=success`,
    cancel_url: `${appOrigin()}/?promotion=cancelled`,
  });
  if (!session.url) throw new ApiError(503, 'Payment checkout is unavailable.');
  return response({ url: session.url, promotionId: promotion.id, minimumTargetCents, targetCents: input.targetCents });
});
