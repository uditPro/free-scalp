import 'server-only';
import Stripe from 'stripe';
import { ApiError, required } from './server';
export function stripe() { return new Stripe(required('STRIPE_SECRET_KEY'), { timeout: 15000, maxNetworkRetries: 1 }); }
export function price(plan: 'starter' | 'pro') { return required(plan === 'starter' ? 'STRIPE_STARTER_PRICE_ID' : 'STRIPE_PRO_PRICE_ID'); }
export function planForPrice(id: string) { if (id === required('STRIPE_STARTER_PRICE_ID')) return 'starter'; if (id === required('STRIPE_PRO_PRICE_ID')) return 'pro'; throw new ApiError(422, 'Unrecognized subscription price.'); }
