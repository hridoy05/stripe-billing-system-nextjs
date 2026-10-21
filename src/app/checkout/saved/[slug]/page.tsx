import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getProductBySlug } from "@/lib/products";
import { hasPurchase } from "@/lib/db";
import { listSavedCards } from "@/lib/saved-payment-methods";
import { SavedCardForm } from "./saved-card-form";

type Props = {
  params: Promise<{ slug: string }>;
};

async function SavedCardCheckoutPage({ params }: Props) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const session = await getSession();
  if (!session) redirect("/login");

  if (await hasPurchase(session.userId, product.id)) {
    redirect(`/products/${product.slug}`);
  }

  const cards = (await listSavedCards(session.userId)).filter(
    (card) => card.allowOffSession
  );

  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.currency.toUpperCase(),
  }).format(product.priceCents / 100);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-md px-6 py-16">
        <Link
          href={`/products/${product.slug}`}
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← Back to {product.name}
        </Link>

        <div className="mt-4 rounded-xl bg-white p-8 dark:bg-zinc-900">
          <h1 className="text-2xl font-semibold">Pay with a saved card</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {product.name} — {price}
          </p>

          {cards.length === 0 ? (
            <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <p>No saved cards are available for future payments.</p>
              <Link
                href="/account/payment-methods"
                className="mt-2 inline-block underline"
              >
                Add a card
              </Link>
            </div>
          ) : (
            <SavedCardForm
              productId={product.id}
              productName={product.name}
              price={price}
              cards={cards}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default function SavedCardCheckoutRoute({ params }: Props) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <SavedCardCheckoutPage params={params} />
    </Suspense>
  );
}
