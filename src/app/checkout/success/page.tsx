import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { getProduct } from "@/lib/products";
import { getPurchaseBySessionId } from "@/lib/db";
import { PaymentConfirmation } from "./payment-confirmation";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

async function Result({
  searchParams,
}: Props) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Missing checkout session</h1>
        <Link href="/products" className="text-sm underline">
          Back to products
        </Link>
      </>
    );
  }

  const session = await getSession();
  if (!session) redirect("/login");

  let paid = false;
  try {
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    paid =
      checkoutSession.payment_status === "paid" ||
      checkoutSession.status === "complete";
  } catch {
    // Fall through and let the webhook confirm the payment.
  }

  const purchase = await getPurchaseBySessionId(sessionId);
  const status = paid && purchase ? "purchased" : "pending";
  const productSlug = purchase ? getProduct(purchase.productId)?.slug : null;

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h1 className="text-2xl font-semibold">Thank you for your purchase!</h1>
      <PaymentConfirmation sessionId={sessionId} initialStatus={status} />
      {productSlug ? (
        <Link
          href={`/products/${productSlug}`}
          className="rounded-full bg-foreground px-5 py-2 text-sm text-background"
        >
          Open your product
        </Link>
      ) : (
        <Link href="/products" className="text-sm underline">
          Back to products
        </Link>
      )}
    </div>
  );
}

export default function SuccessPage({ searchParams }: Props) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-sm rounded-xl bg-white p-8 dark:bg-zinc-900">
        <Suspense fallback={<p>Verifying…</p>}>
          <Result searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
