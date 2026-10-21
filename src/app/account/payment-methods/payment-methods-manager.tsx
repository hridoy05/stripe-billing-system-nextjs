"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { SavedCard } from "@/lib/saved-payment-methods";
import {
  SAVE_CARD_CONSENT_TEXT,
} from "@/lib/consent";
import {
  createSetupIntent,
  getSetupIntentStatus,
  removePaymentMethod,
  setDefaultPaymentMethod,
} from "@/app/actions/saved-payment-methods";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSavedCard(setupIntentId: string): Promise<boolean> {
  const schedule = [...Array(12).fill(1000), ...Array(10).fill(3000)];
  for (const delay of schedule) {
    await sleep(delay);
    const result = await getSetupIntentStatus(setupIntentId);
    if (result.status === "saved") return true;
  }
  return false;
}

function brandLabel(brand: string | null): string {
  if (!brand) return "Card";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

type SaveStage = "consent" | "ready" | "saving" | "verifying";

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

function AddCard({ onSaved }: { onSaved: () => void }) {
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

export function PaymentMethodsManager({
  cards,
  pendingSetupIntentId,
}: {
  cards: SavedCard[];
  pendingSetupIntentId: string | null;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<
    { type: "error" | "success"; text: string } | null
  >(null);
  const [pendingSetupIntent, setPendingSetupIntent] = useState<string | null>(
    pendingSetupIntentId
  );

  useEffect(() => {
    if (!pendingSetupIntent) return;
    let cancelled = false;

    (async () => {
      const saved = await waitForSavedCard(pendingSetupIntent);
      if (cancelled) return;
      if (saved) {
        setMessage({ type: "success", text: "Card saved and ready to use." });
        setPendingSetupIntent(null);
        router.replace("/account/payment-methods");
        router.refresh();
      } else {
        setMessage({
          type: "error",
          text: "Stripe is still confirming this card. Refresh in a moment.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingSetupIntent, router]);

  async function handleDefault(card: SavedCard) {
    setBusyId(card.id);
    setMessage(null);
    const result = await setDefaultPaymentMethod(card.id);
    setBusyId(null);
    if (result.ok) {
      setMessage({ type: "success", text: "Default card updated." });
      router.refresh();
    } else {
      setMessage({ type: "error", text: result.error });
    }
  }

  async function handleRemove(card: SavedCard) {
    const label = card.last4 ? `card ending in ${card.last4}` : "this card";
    if (!window.confirm(`Remove ${label}?`)) return;

    setBusyId(card.id);
    setMessage(null);
    const result = await removePaymentMethod(card.id);
    setBusyId(null);
    if (result.ok) {
      setMessage({ type: "success", text: "Saved card removed." });
      router.refresh();
    } else {
      setMessage({ type: "error", text: result.error });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {message ? (
        <p
          className={
            message.type === "error"
              ? "rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
              : "rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300"
          }
        >
          {message.text}
        </p>
      ) : null}

      <div>
        <h2 className="font-semibold">Saved cards</h2>
        {cards.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No cards saved yet. Add one below to use it for future one-time
            payments.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {cards.map((card) => {
              const expiry =
                card.expMonth && card.expYear
                  ? `${String(card.expMonth).padStart(2, "0")}/${card.expYear}`
                  : null;
              return (
                <li
                  key={card.id}
                  className="flex flex-col gap-3 rounded-xl border border-black/[.08] p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/[.145]"
                >
                  <div>
                    <p className="font-medium">
                      {brandLabel(card.brand)}
                      {card.last4 ? ` •••• ${card.last4}` : ""}
                      {card.isDefault ? (
                        <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                          Default
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {expiry ? `Expires ${expiry}` : "Saved payment method"}
                      {card.allowOffSession
                        ? " · authorized for future payments"
                        : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!card.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleDefault(card)}
                        disabled={busyId === card.id}
                        className="cursor-pointer rounded-full border border-black/[.08] px-3 py-1.5 text-xs transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-white/[.08]"
                      >
                        Set default
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleRemove(card)}
                      disabled={busyId === card.id}
                      className="cursor-pointer rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AddCard
        onSaved={() => {
          setMessage({ type: "success", text: "Card saved and ready to use." });
          router.refresh();
        }}
      />
    </div>
  );
}
