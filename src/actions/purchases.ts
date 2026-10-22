"use server";

import {
  getPurchaseBySessionId,
  getPurchaseByPaymentIntent,
} from "@/lib/purchases";

export type PurchaseStatus = "pending" | "purchased";

export type PurchaseRef = { sessionId: string } | { paymentIntentId: string };

export async function getPurchaseStatus(ref: PurchaseRef): Promise<PurchaseStatus> {
  const purchase =
    "sessionId" in ref
      ? await getPurchaseBySessionId(ref.sessionId)
      : await getPurchaseByPaymentIntent(ref.paymentIntentId);
  return purchase ? "purchased" : "pending";
}
