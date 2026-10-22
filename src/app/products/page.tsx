import { Suspense } from "react";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { PRODUCTS } from "@/lib/products";
import { hasPurchase } from "@/lib/purchases";

type ProductCardProps = {
  productId: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
};

async function ProductCard(props: ProductCardProps) {
  const session = await getSession();
  const purchased = session
    ? await hasPurchase(session.userId, props.productId)
    : false;

  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "usd",
  }).format(props.priceCents / 100);

  return (
    <Link
      href={`/products/${props.slug}`}
      className="block rounded-xl bg-white p-6 transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-black dark:text-zinc-50">
          {props.name}
        </h2>
        <span className="text-lg font-semibold">{price}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {props.description}
      </p>
      <p className="mt-4 text-sm font-medium">
        {purchased ? (
          <span className="text-green-600 dark:text-green-400">Purchased — open</span>
        ) : (
          <span className="text-zinc-500">Locked — buy to unlock</span>
        )}
      </p>
    </Link>
  );
}

export default function ProductsPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Products</h1>
          <Link href="/dashboard" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
            Dashboard
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PRODUCTS.map((product) => (
            <Suspense key={product.id} fallback={<p>Loading…</p>}>
              <ProductCard
                productId={product.id}
                slug={product.slug}
                name={product.name}
                description={product.description}
                priceCents={product.priceCents}
              />
            </Suspense>
          ))}
        </div>
      </main>
    </div>
  );
}
