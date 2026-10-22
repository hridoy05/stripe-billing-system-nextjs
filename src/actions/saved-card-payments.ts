"use server";

import type Stripe from "stripe";
import { getSession } from "@/lib/session";
import { getProduct } from "@/lib/products";
import { getStripe } from "@/lib/stripe";
import { hasPurchase } from "@/lib/purchases";
import { getLocalCustomer } from "@/lib/customers";
import { getRequestOrigin } from "@/lib/request";
import { getSavedCardForUser } from "@/lib/saved-cards";

export type SavedCardPaymentResult =
  | { ok: true; status: "succeeded" | "processing"; paymentIntentId: string }
  | {
      ok: true;
      status: "requires_action";
      paymentIntentId: string;
      clientSecret: string;
    }
  | { ok: false; error: string };

function getStripeCardError(error: unknown): {
  code?: string;
  message?: string;
  paymentIntent: Stripe.PaymentIntent | null;
} | null {
  if (!error || typeof error !== "object") return null;
  const stripeError = error as {
    code?: string;
    message?: string;
    payment_intent?: Stripe.PaymentIntent;
  };
  if (!stripeError.code && !stripeError.payment_intent) return null;
  return {
    code: stripeError.code,
    message: stripeError.message,
    paymentIntent: stripeError.payment_intent ?? null,
  };
}

function isRequestKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{16,64}$/.test(value);
}

export async function payWithSavedCard(
  productId: string,
  paymentMethodId: string,
  requestKey: string
): Promise<SavedCardPaymentResult> {
  if (!isRequestKey(requestKey)) {
    return { ok: false, error: "Invalid payment request. Please try again." };
  }

  const session = await getSession();
  if (!session) {
    return { ok: false, error: "You must be signed in to pay." };
  }

  const product = getProduct(productId);
  if (!product) {
    return { ok: false, error: "Unknown product." };
  }

  const customer = await getLocalCustomer(session.userId);
  if (!customer) {
    return { ok: false, error: "No saved cards found for this account." };
  }

  const card = await getSavedCardForUser(session.userId, paymentMethodId);
  if (!card || card.customerId !== customer.id) {
    return { ok: false, error: "Saved card not found for this account." };
  }
  if (!card.allowOffSession) {
    return {
      ok: false,
      error: "This card is missing authorization for future payments.",
    };
  }

  if (await hasPurchase(session.userId, product.id)) {
    return { ok: false, error: "You already own this product." };
  }

  const stripe = getStripe();
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (paymentMethod.customer !== customer.stripeCustomerId) {
    return {
      ok: false,
      error: "Saved card does not belong to this account.",
    };
  }

  const origin = await getRequestOrigin();
  const metadata = {
    userId: session.userId,
    productId: product.id,
    savedPaymentMethodId: paymentMethodId,
  };

  try {
    const intent = await stripe.paymentIntents.create({
      amount: product.priceCents,
      currency: product.currency,
      customer: customer.stripeCustomerId,
      payment_method: paymentMethodId,
      allowed_payment_method_types: ["card"],
      confirm: true,
      off_session: true,
      metadata,
      return_url: `${origin}/checkout/success?payment_intent={PAYMENT_INTENT_ID}`,
    }, {
      // Dedupes double-clicks and server-action retries: Stripe replays the
      // first response (or rejects parameter changes) for the same key.
      idempotencyKey: `saved-card:${productId}:${paymentMethodId}:${requestKey}`,
    });

    if (
      intent.status === "succeeded" ||
      intent.status === "processing"
    ) {
      return {
        ok: true,
        status: intent.status as "succeeded" | "processing",
        paymentIntentId: intent.id,
      };
    }

    if (intent.status === "requires_action" && intent.client_secret) {
      return {
        ok: true,
        status: "requires_action",
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
      };
    }

    return {
      ok: false,
      error: `Payment did not complete (status: ${intent.status}).`,
    };
  } catch (error) {
    const stripeError = getStripeCardError(error);

    // An off-session payment cannot complete a 3DS challenge. Ask the
    // customer back into the app and retry the same saved card on-session so
    // Stripe.js can run the authentication step.
    if (stripeError?.code === "authentication_required") {
      const failedIntent = stripeError.paymentIntent;
      if (
        failedIntent &&
        failedIntent.status !== "succeeded" &&
        failedIntent.status !== "processing"
      ) {
        try {
          await stripe.paymentIntents.cancel(failedIntent.id);
        } catch (cancelError) {
          console.error("Could not cancel off-session PaymentIntent:", cancelError);
        }
      }

      try {
        const fallback = await stripe.paymentIntents.create({
          amount: product.priceCents,
          currency: product.currency,
          customer: customer.stripeCustomerId,
          payment_method: paymentMethodId,
          allowed_payment_method_types: ["card"],
          metadata: {
            ...metadata,
            authenticationFallback: "true",
          },
        }, {
          idempotencyKey: `saved-card-auth:${
            failedIntent?.id ?? requestKey
          }:${requestKey}`,
        });

        if (fallback.client_secret) {
          return {
            ok: true,
            status: "requires_action",
            paymentIntentId: fallback.id,
            clientSecret: fallback.client_secret,
          };
        }
      } catch (fallbackError) {
        console.error(
          "Could not create on-session authentication PaymentIntent:",
          fallbackError
        );
      }

      return {
        ok: false,
        error:
          "This card needs additional authentication, but the challenge could not be started. Please try again.",
      };
    }

    if (stripeError?.message) {
      console.error("Saved-card payment failed:", stripeError.message);
      return { ok: false, error: stripeError.message };
    }

    if (error instanceof Error) {
      console.error("Saved-card payment failed:", error.message);
      return { ok: false, error: error.message };
    }
    console.error("Saved-card payment failed:", error);
    return { ok: false, error: "Payment failed. Please try another card." };
  }
}
