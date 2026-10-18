import Stripe from "stripe";

let cachedClient: Stripe | null = null;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  if (!cachedClient) {
    cachedClient = new Stripe(secretKey);
  }

  return cachedClient;
}
