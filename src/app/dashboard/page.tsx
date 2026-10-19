import { Suspense } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getSession } from "@/lib/session";
import { PRODUCTS } from "@/lib/products";
import { listPurchasesForUser } from "@/lib/db";

async function PurchaseList() {
  const session = await getSession();
  if (!session) {
    return <p className="text-zinc-600 dark:text-zinc-400">Not signed in.</p>;
  }

  const purchases = await listPurchasesForUser(session.userId);
  const ids = new Set(purchases.map((p) => p.productId));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-zinc-600 dark:text-zinc-400">
        Signed in as <strong>{session.userId}</strong>
      </p>

      <div className="flex flex-col gap-2">
        <Link href="/products" className="font-semibold underline">
          Browse products
        </Link>
        <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          {PRODUCTS.map((product) => (
            <li key={product.id}>
              {ids.has(product.id) ? "✅" : "🔒"} {product.name}
            </li>
          ))}
        </ul>
        {purchases.length > 0 ? (
          <p className="text-xs text-zinc-500">
            {purchases.length} purchase
            {purchases.length === 1 ? "" : "s"} recorded in PostgreSQL.
          </p>
        ) : null}
      </div>

      <form action={logout}>
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2 text-background"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-sm flex-col gap-6 rounded-xl bg-white p-8 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Suspense fallback={<p>Loading…</p>}>
          <PurchaseList />
        </Suspense>
      </main>
    </div>
  );
}
