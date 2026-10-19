import Link from "next/link";

export default function CancelPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-sm rounded-xl bg-white p-8 text-center dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold">Checkout cancelled</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          No charge was made. You can try again at any time.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-full bg-foreground px-5 py-2 text-sm text-background"
        >
          Back to products
        </Link>
      </main>
    </div>
  );
}
