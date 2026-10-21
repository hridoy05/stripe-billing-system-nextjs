import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  claimWebhookEvent,
  releaseWebhookEvent,
  insertPurchase,
  attachSessionIdToPurchase,
} from "@/lib/db";
import {
  removeSavedPaymentMethod,
  syncSetupIntentPaymentMethod,
} from "@/lib/saved-payment-methods";

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  // mode: "payment" — grant access only when payment is fully settled.
  if (session.payment_status !== "paid") {
    console.log(
      `Checkout session ${session.id} not paid (${session.payment_status}); no purchase recorded.`
    );
    return;
  }

  const { userId, productId } = session.metadata ?? {};
  if (!userId || !productId) {
    console.error(
      `Missing metadata on session ${session.id}: cannot record purchase`
    );
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  const created = await insertPurchase({
    userId,
    productId,
    stripeSessionId: session.id,
    stripePaymentIntent: paymentIntentId,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
  });
  if (!created && paymentIntentId) {
    // payment_intent.succeeded already recorded this purchase; link the session id.
    await attachSessionIdToPurchase(paymentIntentId, session.id);
  }
  console.log(`Purchase recorded: user=${userId} product=${productId}`);
}

async function handlePaymentIntentSucceeded(
  intent: Stripe.PaymentIntent
): Promise<void> {
  const { userId, productId } = intent.metadata ?? {};
  if (!userId || !productId) {
    console.error(
      `Missing metadata on payment intent ${intent.id}: cannot record purchase`
    );
    return;
  }

  await insertPurchase({
    userId,
    productId,
    stripeSessionId: null,
    stripePaymentIntent: intent.id,
    amountCents: intent.amount_received,
    currency: intent.currency,
  });
  console.log(`Purchase recorded: user=${userId} product=${productId}`);
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object);
      break;

    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(event.data.object);
      break;

    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      const message = intent.last_payment_error?.message ?? "Unknown reason";
      console.log(
        `Payment failed: intent=${intent.id} reason="${message}" — no purchase recorded`
      );
      break;
    }

    case "setup_intent.succeeded":
      await syncSetupIntentPaymentMethod(event.data.object);
      break;

    case "setup_intent.setup_failed": {
      const intent = event.data.object;
      const message = intent.last_setup_error?.message ?? "Unknown reason";
      console.log(
        `Card setup failed: intent=${intent.id} reason="${message}" — no card saved`
      );
      break;
    }

    case "payment_method.detached": {
      const removed = await removeSavedPaymentMethod(event.data.object.id);
      console.log(
        `Payment method detached: ${event.data.object.id} (local record removed: ${removed})`
      );
      break;
    }

    default:
      break;
  }
}

export async function POST(request: Request) {
  const stripe = getStripe();

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency guard: only the first delivery of an event is processed.
  const claimed = await claimWebhookEvent(event.id);
  if (!claimed) {
    console.log(`Webhook event ${event.id} already processed, skipping.`);
    return Response.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event);
  } catch (error) {
    console.error(`Failed to process webhook event ${event.id}:`, error);
    // Allow Stripe's retry to run this event again instead of treating the
    // failed attempt as permanently processed. If the release itself fails
    // (e.g. the database is down), keep the original error and the 500 so
    // Stripe still retries.
    try {
      await releaseWebhookEvent(event.id);
    } catch (releaseError) {
      console.error(
        `Could not release webhook event ${event.id} for retry:`,
        releaseError
      );
    }
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
