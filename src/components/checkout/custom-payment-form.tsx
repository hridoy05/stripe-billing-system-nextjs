"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { createPaymentIntent } from "@/actions/payments";
import { getPurchaseStatus, type PurchaseStatus } from "@/actions/purchases";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

type Phase = "idle" | "creating" | "ready";
type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "verifying" }
  | { status: "purchased" }
  | { status: "error"; message: string };

function CheckoutForm({ clientSecret }: { clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

  const paymentIntentId = clientSecret.split("_secret_")[0];

  const pollForPurchase = useCallback(async () => {
    // 10 fast attempts, then every 3s — gives the webhook ~50s to land before
    // the UI gives up and lets the user retry manually.
    const schedule = [
      ...Array(10).fill(1000),
      ...Array(15).fill(3000),
    ] as const;
    for (const interval of schedule) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      const status: PurchaseStatus = await getPurchaseStatus({
        paymentIntentId,
      });
      if (status === "purchased") {
        setSubmit({ status: "purchased" });
        router.refresh();
        return true;
      }
    }
    setSubmit({
      status: "error",
      message:
        "Payment is still being verified. Check your dashboard in a moment.",
    });
    return false;
  }, [paymentIntentId, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmit({ status: "submitting" });

    // Required before confirmPayment: validates/detects the payment method
    // (e.g. card details) without any other asynchronous work in between.
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setSubmit({
        status: "error",
        message: submitError.message ?? "Please check your payment details.",
      });
      return;
    }

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        // Full redirects (some 3DS/bank flows) land here; the success page
        // verifies the purchase via the webhook-driven database record.
        return_url: `${window.location.origin}/checkout/success?payment_intent={PAYMENT_INTENT_ID}`,
      },
      redirect: "if_required",
    });

    if (error) {
      setSubmit({ status: "error", message: error.message ?? "Payment failed." });
      return;
    }

    if (
      paymentIntent &&
      paymentIntent.status !== "succeeded" &&
      paymentIntent.status !== "processing"
    ) {
      setSubmit({
        status: "error",
        message: `Payment did not complete (status: ${paymentIntent.status}).`,
      });
      return;
    }

    // The webhook is the source of truth — poll until the purchase row lands.
    setSubmit({ status: "verifying" });
    await pollForPurchase();
  }

  if (submit.status === "purchased") {
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

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <PaymentElement />

      {submit.status === "error" ? (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          <p>{submit.message}</p>
          <button
            type="button"
            onClick={() => {
              setSubmit({ status: "verifying" });
              pollForPurchase();
            }}
            className="mt-2 cursor-pointer underline opacity-80 hover:opacity-100"
          >
            Check again
          </button>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!stripe || !elements || submit.status !== "idle"}
        className="mt-6 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full bg-foreground px-6 text-sm text-background transition-colors hover:opacity-80 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-80 dark:bg-background dark:text-foreground"
      >
        {submit.status === "submitting"
          ? "Processing…"
          : submit.status === "verifying"
            ? "Verifying payment…"
            : "Pay now"}
      </button>
    </form>
  );
}

export function CustomPaymentForm({ productId }: { productId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    (async () => {
      setPhase("creating");
      const result = await createPaymentIntent(productId);
      if (result.ok) {
        setClientSecret(result.clientSecret);
        setPhase("ready");
      } else {
        setError(result.error);
        setPhase("idle");
      }
    })();
  }, [productId]);

  if (!publishableKey || !stripePromise) {
    return (
      <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        Custom payments are not configured: set
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env.local and restart the dev
        server.
      </p>
    );
  }

  if (error) {
    return (
      <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
        {error}
      </p>
    );
  }

  if (phase !== "ready" || !clientSecret) {
    return <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">Preparing payment…</p>;
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: "stripe" },
      }}
    >
      <CheckoutForm clientSecret={clientSecret} />
    </Elements>
  );
}
