import type Stripe from 'stripe';
import { homepagePromotionSchema } from '@/lib/validation';
import { admin, appOrigin, checkOrigin, json, response, route, ApiError } from '@/lib/server';
import { stripe } from '@/lib/billing';
import { resolveHomepageMetadata } from '@/lib/homepage-metadata';

export const dynamic = 'force-dynamic';

function identityLabel(input: { websiteUrl?: string; xUsername?: string }) {
  if (input.websiteUrl) return new URL(input.websiteUrl).hostname.replace(/^www\./, '');
  return `@${input.xUsername!.replace(/^@/, '')}`;
}

export const GET = route(async () => {
  const { data, error } = await admin().from('homepage_promotions').select('id,website_url,x_username,destination_url,display_name,description,logo_url,metadata_status,current_bid_cents,last_payment_at').eq('status', 'active').order('current_bid_cents', { ascending: false }).order('last_payment_at', { ascending: true }).limit(20);
  if (error) throw error;
  return response({ promotions: (data ?? []).map((promotion, index) => ({ ...promotion, rank: index + 1, current_bid_cents: Number(promotion.current_bid_cents) })) });
});

export const POST = route(async request => {
  checkOrigin(request);
  const input = await json(request, homepagePromotionSchema);
  const db = admin();
  const client = stripe();
  const origin = appOrigin();
  const metadata = await resolveHomepageMetadata(input);
  const { data: active, error: activeError } = await db.from('homepage_promotions').select('id,current_bid_cents').eq('status', 'active');
  if (activeError) throw activeError;
  const highestBidCents = Math.max(0, ...(active ?? []).map(promotion => Number(promotion.current_bid_cents ?? 0)));
  const { data: existing, error: existingError } = await db.from('homepage_promotions').select('id,current_bid_cents,status').eq('normalized_key', metadata.normalizedKey).maybeSingle();
  if (existingError) throw existingError;
  const currentBidCents = Number(existing?.current_bid_cents ?? 0);
  const highestOtherBidCents = Math.max(0, ...(active ?? []).filter(promotion => promotion.id !== existing?.id).map(promotion => Number(promotion.current_bid_cents ?? 0)));
  const minimumTargetCents = Math.max(100, currentBidCents + 100, highestOtherBidCents + 100);
  if (input.targetCents < minimumTargetCents) throw new ApiError(400, `The current top bid is $${(highestBidCents / 100).toFixed(2)}. Bid at least $${(minimumTargetCents / 100).toFixed(2)} to enter.`);

  const chargeCents = input.targetCents - currentBidCents;
  let promotion = existing;
  if (!promotion) {
    const { data: created, error: insertError } = await db.from('homepage_promotions').insert({ normalized_key: metadata.normalizedKey, website_url: input.websiteUrl ?? null, x_username: input.xUsername?.replace(/^@/, '') ?? null, destination_url: metadata.destinationUrl, display_name: metadata.displayName, description: metadata.description, logo_url: metadata.logoUrl, metadata_status: metadata.metadataStatus, metadata_fetched_at: new Date().toISOString(), terms_accepted_at: new Date().toISOString(), terms_version: 'homepage-promotion-v1' }).select('id,current_bid_cents,status').single();
    if (insertError) throw insertError;
    promotion = created;
  } else if (existing) {
    const existingId = existing.id;
    const { error: updateError } = await db.from('homepage_promotions').update({ destination_url: metadata.destinationUrl, display_name: metadata.displayName, description: metadata.description, logo_url: metadata.logoUrl, metadata_status: metadata.metadataStatus, metadata_fetched_at: new Date().toISOString(), terms_accepted_at: new Date().toISOString(), terms_version: 'homepage-promotion-v1' }).eq('id', existingId);
    if (updateError) throw updateError;
  }
  const label = metadata.displayName || identityLabel(input);
  let session: Stripe.Checkout.Session;
  try {
    session = await client.checkout.sessions.create({
      mode: 'payment',
      customer_creation: 'always',
      line_items: [{ price_data: { currency: 'usd', product_data: { name: `Homepage sponsored placement: ${label}`, description: `Clearly labeled homepage visibility for ${label} on ReachFlow.` }, unit_amount: chargeCents }, quantity: 1 }],
      metadata: { homepage_promotion_id: promotion.id, target_cents: String(input.targetCents), charge_cents: String(chargeCents), terms_version: 'homepage-promotion-v1' },
      payment_intent_data: { metadata: { homepage_promotion_id: promotion.id, target_cents: String(input.targetCents), charge_cents: String(chargeCents) } },
      success_url: `${origin}/?promotion=success`,
      cancel_url: `${origin}/?promotion=cancelled`,
    }, { idempotencyKey: `homepage-promotion-${promotion.id}-${input.targetCents}` });
  } catch {
    await db.from('homepage_promotions').delete().eq('id', promotion.id).eq('status', 'inactive');
    throw new ApiError(502, 'Stripe could not open checkout. Check the server Stripe key and try again.');
  }
  if (!session.url) throw new ApiError(503, 'Payment checkout is unavailable.');
  return response({ url: session.url, promotionId: promotion.id, minimumTargetCents, targetCents: input.targetCents, chargeCents, metadata });
});
