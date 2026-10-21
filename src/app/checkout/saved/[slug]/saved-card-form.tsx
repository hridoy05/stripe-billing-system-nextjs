"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import type { SavedCard } from "@/lib/saved-payment-methods";
import { payWithSavedCard } from "@/app/actions/saved-payment-methods";
import { getPurchaseStatus } from "@/app/actions/purchases";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

type Phase =
  | { status: "idle" }
  | { status: "paying" }
  | { status: "authenticating" }
  | { status: "verifying" }
  | { status: "purchased" }
  | { status: "error"; message: string };

function brandLabel(brand: string | null): string {
  if (!brand) return "Card";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

async function waitForPurchase(paymentIntentId: string): Promise<boolean> {
  const schedule = [...Array(10).fill(1000), ...Array(15).fill(3000)];
  for (const delay of schedule) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    const status = await getPurchaseStatus({ paymentIntentId });
    if (status === "purchased") return true;
  }
  return false;
}

export function SavedCardForm({
  productId,
  productName,
  price,
  cards,
}: {
  productId: string;
  productName: string;
  price: string;
  cards: SavedCard[];
}) {
  const router = useRouter();
  const defaultCard =
    cards.find((card) => card.isDefault) ?? cards[0] ?? null;
  const [selectedId, setSelectedId] = useState(defaultCard?.id ?? "");
  const [phase, setPhase] = useState<Phase>({ status: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;

    setPhase({ status: "paying" });

    // Random key per attempt: Stripe replays the first response for duplicate
    // double-clicks/Action retries instead of creating a second charge.
    const result = await payWithSavedCard(
      productId,
      selectedId,
      crypto.randomUUID()
    );
    if (!result.ok) {
      setPhase({ status: "error", message: result.error });
      return;
    }

    let paymentIntentId = result.paymentIntentId;

    if (result.status === "requires_action") {
      if (!stripePromise) {
        setPhase({
          status: "error",
          message: "Stripe is not configured for authentication.",
        });
        return;
      }

      setPhase({ status: "authenticating" });
      const stripe = await stripePromise;
      if (!stripe) {
        setPhase({
          status: "error",
          message: "Could not load Stripe to complete authentication.",
        });
        return;
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(
        result.clientSecret,
        {
          return_url: `${window.location.origin}/checkout/success?payment_intent=${result.paymentIntentId}`,
        }
      );

      if (error) {
        setPhase({
          status: "error",
          message: error.message ?? "Additional authentication failed.",
        });
        return;
      }

      if (
        !paymentIntent ||
        (paymentIntent.status !== "succeeded" &&
          paymentIntent.status !== "processing")
      ) {
        setPhase({
          status: "error",
          message: `Payment did not complete (status: ${
            paymentIntent?.status ?? "unknown"
          }).`,
        });
        return;
      }

      paymentIntentId = paymentIntent.id;
    }

    // The webhook, not the browser response, is the source of truth for grants.
    setPhase({ status: "verifying" });
    const purchased = await waitForPurchase(paymentIntentId);
    if (!purchased) {
      setPhase({
        status: "error",
        message:
          "Payment is still being verified. Check your dashboard in a moment.",
      });
      return;
    }

    setPhase({ status: "purchased" });
    router.refresh();
  }

  if (phase.status === "purchased") {
    return (
      <div className="mt-6">
        <span className="rounded-full bg-green-100 px-4 py-1 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
          Payment confirmed — access granted
        </span>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-4 block cursor-pointer text-sm underline underline-offset-2 hover:opacity-80"
        >
          Continue
        </button>
      </div>
    );
  }

  const busy =
    phase.status === "paying" ||
    phase.status === "authenticating" ||
    phase.status === "verifying";

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <fieldset disabled={busy} className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Choose a saved card</legend>
        {cards.map((card) => {
          const expiry =
            card.expMonth && card.expYear
              ? `${String(card.expMonth).padStart(2, "0")}/${card.expYear}`
              : null;
          return (
            <label
              key={card.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/[.08] p-4 text-sm dark:border-white/[.145]"
            >
              <input
                type="radio"
                name="paymentMethodId"
                value={card.id}
                checked={selectedId === card.id}
                onChange={(event) => setSelectedId(event.target.value)}
                className="h-4 w-4"
              />
              <span>
                <span className="font-medium">
                  {brandLabel(card.brand)}
                  {card.last4 ? ` •••• ${card.last4}` : ""}
                </span>
                {card.isDefault ? (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                    Default
                  </span>
                ) : null}
                {expiry ? (
                  <span className="ml-2 text-xs text-zinc-500">
                    Expires {expiry}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </fieldset>

      {phase.status === "error" ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {phase.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !selectedId}
        className="mt-6 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full bg-foreground px-6 text-sm text-background transition-colors hover:opacity-80 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-background dark:text-foreground"
      >
        {phase.status === "paying"
          ? "Charging saved card…"
          : phase.status === "authenticating"
            ? "Complete authentication…"
            : phase.status === "verifying"
              ? "Verifying payment…"
              : `Pay ${price} for ${productName}`}
      </button>
    </form>
  );
}
