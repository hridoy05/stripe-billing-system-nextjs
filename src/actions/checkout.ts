"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { getProduct } from "@/lib/products";
import { getStripe } from "@/lib/stripe";

export async function startCheckout(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  const productId = String(formData.get("productId") ?? "");
  const product = getProduct(productId);
  if (!product) throw new Error("Unknown product");

  const stripe = getStripe();

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const forwardedProto = headerList.get("x-forwarded-proto");
  const proto = forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: product.currency,
          unit_amount: product.priceCents,
          product_data: {
            name: product.name,
            description: product.description,
          },
        },
      },
    ],
    metadata: {
      userId: session.userId,
      productId: product.id,
    },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/products/${product.slug}?checkout=cancelled`,
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  redirect(checkoutSession.url);
}
