import { checkoutSchema } from '@/lib/validation';
import { stripe, price } from '@/lib/billing';
import { identity, admin, appOrigin, checkOrigin, json, response, route, ApiError } from '@/lib/server';
export const POST = route(async request => {
  checkOrigin(request); const { plan } = await json(request, checkoutSchema); const { user } = await identity(); const db = admin(); const client = stripe();
  const { data: profile, error } = await db.from('profiles').select('stripe_customer_id,stripe_subscription_id').eq('id', user.id).single();
  if (error) throw new ApiError(503, 'Billing is temporarily unavailable.');
  if (profile.stripe_subscription_id) throw new ApiError(409, 'Manage your existing subscription in the billing portal.');
  let customer = profile.stripe_customer_id as string | null;
  if (!customer) {
    const created = await client.customers.create({ email: user.email, metadata: { user_id: user.id } }, { idempotencyKey: `customer-${user.id}` });
    const saved = await db.from('profiles').update({ stripe_customer_id: created.id }).eq('id', user.id).is('stripe_customer_id', null);
    if (saved.error) throw new ApiError(503, 'Billing is temporarily unavailable.');
    const { data: current, error: readError } = await db.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
    if (readError || !current?.stripe_customer_id) throw new ApiError(503, 'Billing is temporarily unavailable.');
    customer = current.stripe_customer_id;
  }
  const existing = await client.subscriptions.list({ customer: customer!, status: 'all', limit: 100 });
  if (existing.has_more || existing.data.some(item => !['canceled', 'incomplete_expired'].includes(item.status))) throw new ApiError(409, 'Manage your existing subscription in the billing portal.');
  // A database lease ensures concurrent browser requests share one Stripe session.
  const lease = await db.rpc('reserve_checkout', { p_user: user.id, p_plan: plan });
  if (lease.error) {
    if (lease.error.message.includes('CHECKOUT_IN_PROGRESS')) throw new ApiError(409, 'A checkout for another plan is already open. Finish it or retry after it expires.');
    throw new ApiError(503, 'Checkout is temporarily unavailable.');
  }
  const session = await client.checkout.sessions.create({ mode: 'subscription', customer: customer!, client_reference_id: user.id, expires_at: lease.data.expires_at, line_items: [{ price: price(plan), quantity: 1 }], subscription_data: { metadata: { user_id: user.id } }, success_url: `${appOrigin()}/dashboard?billing=success`, cancel_url: `${appOrigin()}/pricing?billing=cancelled` }, { idempotencyKey: `checkout-${lease.data.slot}` });
  if (!session.url) throw new ApiError(503, 'Checkout is unavailable.'); return response({ url: session.url });
});
