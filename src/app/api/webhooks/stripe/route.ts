import { getStripe } from "@/lib/stripe";
import { claimWebhookEvent, releaseWebhookEvent } from "@/lib/stripe-events";
import { handleStripeEvent } from "@/lib/webhooks";

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

  let event;
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
    await handleStripeEvent(event);
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
