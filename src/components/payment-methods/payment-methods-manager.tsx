"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SavedCard } from "@/lib/saved-cards";
import {
  cardBrandLabel,
  formatCardExpiry,
} from "@/lib/card-display";
import {
  removePaymentMethod,
  setDefaultPaymentMethod,
} from "@/actions/payment-methods";
import { waitForSavedCard } from "./wait-for-saved-card";
import { AddCard } from "./add-card";

type ManagerMessage = { type: "error" | "success"; text: string } | null;

export function PaymentMethodsManager({
  cards,
  pendingSetupIntentId,
}: {
  cards: SavedCard[];
  pendingSetupIntentId: string | null;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<ManagerMessage>(null);
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
              const expiry = formatCardExpiry(card.expMonth, card.expYear);
              return (
                <li
                  key={card.id}
                  className="flex flex-col gap-3 rounded-xl border border-black/[.08] p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/[.145]"
                >
                  <div>
                    <p className="font-medium">
                      {cardBrandLabel(card.brand)}
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
