import type Stripe from "stripe";
import {
  attachSessionIdToPurchase,
  insertPurchase,
} from "@/lib/purchases";
import {
  removeSavedPaymentMethod,
  syncSetupIntentPaymentMethod,
} from "@/lib/saved-cards";

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

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
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
