import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listSavedCards } from "@/lib/saved-payment-methods";
import { PaymentMethodsManager } from "./payment-methods-manager";

type Props = {
  searchParams: Promise<{ setup_intent?: string }>;
};

async function PaymentMethods({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { setup_intent: pendingSetupIntentId } = await searchParams;
  const cards = await listSavedCards(session.userId);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payment methods</h1>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          Dashboard
        </Link>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Save a card once and reuse it for future one-time payments. Your card
        number and CVC never touch this application.
      </p>
      <div className="mt-6">
        <PaymentMethodsManager
          cards={cards}
          pendingSetupIntentId={pendingSetupIntentId ?? null}
        />
      </div>
    </>
  );
}

export default function PaymentMethodsPage({ searchParams }: Props) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <Suspense fallback={<p>Loading…</p>}>
          <PaymentMethods searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
