import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { startCheckout } from "@/actions/checkout";
import { getSession } from "@/lib/session";
import { getProductBySlug } from "@/lib/products";
import { hasPurchase } from "@/lib/purchases";
import { listSavedCards } from "@/lib/saved-cards";
import { BuyButton } from "@/components/products/buy-button";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkout?: string }>;
};

async function ProductDetail({ params, searchParams }: Props) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const { checkout } = await searchParams;
  const session = await getSession();
  const purchased = session
    ? await hasPurchase(session.userId, product.id)
    : false;
  const savedCards =
    session && !purchased ? await listSavedCards(session.userId) : [];

  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.currency.toUpperCase(),
  }).format(product.priceCents / 100);

  return (
    <>
      <Link
        href="/products"
        className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← Back to products
      </Link>

      {checkout === "cancelled" ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          Checkout was cancelled — your card was not charged.
        </p>
      ) : null}

      <div className="mt-4 rounded-xl bg-white p-8 dark:bg-zinc-900">
        <h1 className="text-3xl font-semibold">{product.name}</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {product.description}
        </p>
        <p className="mt-4 text-2xl font-semibold">{price}</p>

        {purchased ? (
          <div className="mt-6 rounded-lg bg-green-50 p-6 dark:bg-green-950">
            <p className="font-semibold text-green-700 dark:text-green-300">
              Unlocked
            </p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              <p>
                1) Payment-flow checklist: session created → hosted page →
                webhook verified → DB row persisted.
              </p>
              <p>
                2) Webhook testing templates for checkout.session.completed,
                with event-level idempotency keys.
              </p>
              <p>
                3) The 10-minute quickstart guide: from Stripe key to a live
                purchase in a single test run.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            {session ? (
              <>
                <form action={startCheckout}>
                  <input type="hidden" name="productId" value={product.id} />
                  <BuyButton />
                </form>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  or{" "}
                  <Link
                    href={`/checkout/custom/${product.slug}`}
                    className="underline"
                  >
                    pay in app with the custom card form
                  </Link>{" "}
                  (Stripe Elements + PaymentIntent)
                </p>
                {savedCards.length > 0 ? (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    or{" "}
                    <Link
                      href={`/checkout/saved/${product.slug}`}
                      className="underline"
                    >
                      pay with a saved card
                    </Link>{" "}
                    ({savedCards.length} saved)
                  </p>
                ) : null}
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-full border border-black/[.08] px-5 text-sm dark:border-white/[.145]"
              >
                Sign in to purchase
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function ProductPage({ params, searchParams }: Props) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <Suspense fallback={<p>Loading…</p>}>
          <ProductDetail params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
