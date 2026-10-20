"use client";

import { useFormStatus } from "react-dom";

export function BuyButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 cursor-pointer items-center rounded-full bg-foreground px-6 text-sm text-background transition-colors hover:opacity-80 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-80 dark:bg-background dark:text-foreground"
    >
      {pending ? "Redirecting to Stripe…" : "Buy now"}
    </button>
  );
}
