import 'server-only';
import Stripe from 'stripe';
import { ApiError, required } from './server';
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new ApiError(503, 'Stripe payments are not configured. Set STRIPE_SECRET_KEY on the server.');
  return new Stripe(key, { timeout: 15000, maxNetworkRetries: 1 });
}
export function stripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new ApiError(503, 'Stripe webhooks are not configured. Set STRIPE_WEBHOOK_SECRET on the server.');
  return secret;
}
export function price(plan: 'starter' | 'pro') { return required(plan === 'starter' ? 'STRIPE_STARTER_PRICE_ID' : 'STRIPE_PRO_PRICE_ID'); }
export function planForPrice(id: string) { if (id === required('STRIPE_STARTER_PRICE_ID')) return 'starter'; if (id === required('STRIPE_PRO_PRICE_ID')) return 'pro'; throw new ApiError(422, 'Unrecognized subscription price.'); }
