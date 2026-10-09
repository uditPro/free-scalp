import type Stripe from 'stripe';
import { stripe, planForPrice } from '@/lib/billing';
import { admin, required, response, route, ApiError } from '@/lib/server';
export const runtime = 'nodejs';
export const POST = route(async request => {
  const client = stripe(); const signature = request.headers.get('stripe-signature');
  if (!signature) throw new ApiError(400, 'Missing webhook signature.');
  const raw = await request.text(); if (raw.length > 1000000) throw new ApiError(413, 'Webhook is too large.');
  let event: Stripe.Event;
  try { event = client.webhooks.constructEvent(raw, signature, required('STRIPE_WEBHOOK_SECRET')); } catch { throw new ApiError(400, 'Invalid webhook signature.'); }
  if (!['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) return response({ received: true });
  const subscription = event.data.object as Stripe.Subscription;
  const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const db = admin();
  const { data: profile, error } = await db.from('profiles').select('id').eq('stripe_customer_id', customer).maybeSingle();
  if (error || !profile) throw new ApiError(503, 'Billing account is not ready for reconciliation.');
  // Reconcile current Stripe state, never grant access from an old event payload.
  const observedAt = new Date().toISOString();
  const subscriptions = await client.subscriptions.list({ customer, status: 'all', limit: 100 });
  if (subscriptions.has_more) throw new ApiError(503, 'Billing account requires reconciliation.');
  let plan: 'free' | 'starter' | 'pro' = 'free'; let subscriptionId: string | null = null;
  for (const current of subscriptions.data) {
    if (['canceled', 'incomplete_expired'].includes(current.status)) continue;
    subscriptionId ??= current.id;
    if (!['active', 'trialing'].includes(current.status)) continue;
    for (const item of current.items.data) {
      const candidate = planForPrice(item.price.id);
      if (plan !== 'pro') { plan = candidate; subscriptionId = current.id; }
    }
  }
  const applied = await db.rpc('apply_billing_event', { p_event_id: event.id, p_event_created: event.created, p_observed_at: observedAt, p_user: profile.id, p_customer: customer, p_subscription: subscriptionId, p_plan: plan });
  if (applied.error) throw new ApiError(503, 'Billing update could not be saved.');
  return response({ received: true });
});
