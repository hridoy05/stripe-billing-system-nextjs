import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { claimWebhookEvent, insertPurchase } from "@/lib/db";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // mode: "payment" — grant access only when payment is fully settled.
    if (session.payment_status !== "paid") {
      return Response.json({ received: true, status: session.payment_status });
    }

    const { userId, productId } = session.metadata ?? {};
    if (!userId || !productId) {
      console.error(
        `Missing metadata on session ${session.id}: cannot record purchase`
      );
      return Response.json({ received: true }, { status: 200 });
    }

    try {
      await insertPurchase({
        userId,
        productId,
        stripeSessionId: session.id,
        stripePaymentIntent:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        amountCents: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
      });
      console.log(`Purchase recorded: user=${userId} product=${productId}`);
    } catch (error) {
      console.error("Failed to record purchase:", error);
      return Response.json({ error: "Database failure" }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}
