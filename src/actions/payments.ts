"use server";

import { getSession } from "@/lib/session";
import { getProduct } from "@/lib/products";
import { getStripe } from "@/lib/stripe";

export type CreatePaymentIntentResult =
  | { ok: true; clientSecret: string }
  | { ok: false; error: string };

export async function createPaymentIntent(
  productId: string
): Promise<CreatePaymentIntentResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "You must be signed in to pay." };
  }

  const product = getProduct(productId);
  if (!product) {
    return { ok: false, error: "Unknown product." };
  }

  const stripe = getStripe();

  const paymentIntent = await stripe.paymentIntents.create({
    amount: product.priceCents,
    currency: product.currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      userId: session.userId,
      productId: product.id,
    },
  });

  if (!paymentIntent.client_secret) {
    return { ok: false, error: "Stripe did not return a client secret." };
  }

  return { ok: true, clientSecret: paymentIntent.client_secret };
}
