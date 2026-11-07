// Stripe on the server. Returns null when no keys are set, so the app still runs in test mode.
import "server-only";
import Stripe from "stripe";

let client: Stripe | null | undefined;
export function stripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  client = key ? new Stripe(key) : null;
  return client;
}
export const paymentsEnabled = () => !!stripe() && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();

/** Link into the Stripe dashboard (test or live, matching the secret key), e.g. stripeDashboard("payments/pi_123"). */
export function stripeDashboard(path: string) {
  const test = /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY?.trim() ?? "");
  return `https://dashboard.stripe.com/${test ? "test/" : ""}${path}`;
}

/** Card holds on online payments last about 7 days; authorize at checkout only if delivery is this soon. */
export const HOLD_AT_CHECKOUT_WITHIN_DAYS = 5;
