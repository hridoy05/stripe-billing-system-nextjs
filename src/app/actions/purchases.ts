"use server";

import { getPurchaseBySessionId } from "@/lib/db";

export type PurchaseStatus = "pending" | "purchased";

export async function getPurchaseStatus(
  sessionId: string
): Promise<PurchaseStatus> {
  const purchase = await getPurchaseBySessionId(sessionId);
  return purchase ? "purchased" : "pending";
}
