-- Custom PaymentIntent flow: purchases are keyed by PaymentIntent instead of Checkout Session.
ALTER TABLE "purchases" ALTER COLUMN "stripe_session_id" DROP NOT NULL;

-- Unique per PaymentIntent so webhook-driven inserts stay idempotent.
CREATE UNIQUE INDEX "purchases_stripe_payment_intent_key" ON "purchases"("stripe_payment_intent");
