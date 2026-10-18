import Link from "next/link";

const features = [
  {
    title: "Secure checkout sessions",
    body: "Create Stripe Checkout Sessions from server actions, so keys never touch the client.",
  },
  {
    title: "Stateless auth",
    body: "HMAC-signed session cookies built from scratch — no third-party auth library.",
  },
  {
    title: "Webhook-ready",
    body: "Verify fpx events server-side and fulfil orders the moment payment succeeds.",
  },
  {
    title: "Protected flows",
    body: "Proxy-level route protection with optimistic session checks before render.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-center gap-10 py-24 text-center">
        <p className="rounded-full border border-black/[.08] px-4 py-1 text-sm text-zinc-600 dark:border-white/[.145] dark:text-zinc-400">
          stripe-paymentf-flow
        </p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-black sm:text-5xl dark:text-zinc-50">
          Payments that flow,{" "}
          <span className="text-zinc-500 dark:text-zinc-400">
            built on Stripe
          </span>
        </h1>
        <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          A Next.js playground for the complete payment lifecycle: sign in,
          start a checkout, and land on a dashboard that reacts to real
          Stripe events.
        </p>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <Link
            href="/dashboard"
            className="flex h-12 w-full items-center justify-center rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] sm:w-auto sm:px-10"
          >
            Open dashboard
          </Link>
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-full border border-black/[.08] px-6 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] sm:w-auto sm:px-10"
          >
            Sign in
          </Link>
          <Link
            href="/products"
            className="flex h-12 items-center justify-center rounded-full border border-black/[.08] px-6 text-base font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Browse products
          </Link>
        </div>
        <div className="grid w-full grid-cols-1 gap-4 pt-8 text-left sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl bg-white p-6 dark:bg-zinc-900"
            >
              <h2 className="font-semibold text-black dark:text-zinc-50">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
