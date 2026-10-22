"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { SAVE_CARD_CONSENT_TEXT } from "@/lib/consent";
import { createSetupIntent } from "@/actions/payment-methods";
import { waitForSavedCard } from "./wait-for-saved-card";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

type SaveStage = "ready" | "saving" | "verifying";

function AddCardForm({
  clientSecret,
  setupIntentId,
  onSaved,
}: {
  clientSecret: string;
  setupIntentId: string;
  onSaved: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [stage, setStage] = useState<SaveStage>("ready");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setStage("saving");
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setStage("ready");
      setError(submitError.message ?? "Please check your card details.");
      return;
    }

    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/account/payment-methods?setup_intent=${setupIntentId}`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setStage("ready");
      setError(confirmError.message ?? "Could not save this card.");
      return;
    }

    setStage("verifying");
    const saved = await waitForSavedCard(setupIntentId);
    if (!saved) {
      setStage("ready");
      setError(
        "Stripe is still processing this card. Refresh in a moment to check."
      );
      return;
    }

    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <PaymentElement />

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!stripe || !elements || stage !== "ready"}
        className="mt-6 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full bg-foreground px-6 text-sm text-background transition-colors hover:opacity-80 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-background dark:text-foreground"
      >
        {stage === "saving"
          ? "Saving card…"
          : stage === "verifying"
            ? "Verifying with webhook…"
            : "Save card securely"}
      </button>
    </form>
  );
}

export function AddCard({ onSaved }: { onSaved: () => void }) {
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupIntentId, setSetupIntentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!consentAccepted) {
      setError("Please accept the authorization before saving a card.");
      return;
    }

    setCreating(true);
    setError(null);

    const result = await createSetupIntent(true);
    if (!result.ok) {
      setCreating(false);
      setError(result.error);
      return;
    }

    setClientSecret(result.clientSecret);
    setSetupIntentId(result.setupIntentId);
    setCreating(false);
  }

  if (!publishableKey || !stripePromise) {
    return (
      <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        Card saving is not configured: set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
        in .env.local and restart the dev server.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]">
      <h2 className="font-semibold">Add a card</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Card details go directly to Stripe. This app only stores the brand,
        last four digits, and expiry.
      </p>

      {!clientSecret ? (
        <>
          <label className="mt-4 flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(event) => {
                setConsentAccepted(event.target.checked);
                if (event.target.checked) setError(null);
              }}
              className="mt-1 h-4 w-4"
            />
            <span>{SAVE_CARD_CONSENT_TEXT}</span>
          </label>

          {!consentAccepted ? (
            <p className="mt-2 text-xs text-zinc-500">
              Required. Consent is recorded with a timestamp, IP address, and
              browser user agent.
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleStart}
            disabled={creating || !consentAccepted}
            className="mt-6 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full bg-foreground px-6 text-sm text-background transition-colors hover:opacity-80 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-background dark:text-foreground"
          >
            {creating ? "Preparing secure form…" : "Continue to card details"}
          </button>
        </>
      ) : (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: { theme: "stripe" },
          }}
        >
          <AddCardForm
            clientSecret={clientSecret}
            setupIntentId={setupIntentId!}
            onSaved={() => {
              setClientSecret(null);
              setSetupIntentId(null);
              setConsentAccepted(false);
              onSaved();
            }}
          />
        </Elements>
      )}
    </div>
  );
}
