"use client";

import { useFormStatus } from "react-dom";

export function BuyButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center rounded-full bg-foreground px-6 text-sm text-background disabled:opacity-50 dark:bg-background dark:text-foreground"
    >
      {pending ? "Redirecting to Stripe…" : "Buy now"}
    </button>
  );
}
