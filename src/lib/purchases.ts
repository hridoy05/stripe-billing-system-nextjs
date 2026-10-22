import { prisma, isUniqueConstraintViolation } from "@/lib/db";

export type PurchaseRecord = {
  productId: string;
  amountCents: number;
  currency: string;
  createdAt: string;
};

export async function hasPurchase(
  userId: string,
  productId: string
): Promise<boolean> {
  const purchase = await prisma.purchase.findFirst({
    where: { userId, productId },
    select: { id: true },
  });
  return purchase !== null;
}

export async function getPurchaseBySessionId(
  sessionId: string
): Promise<PurchaseRecord | null> {
  const row = await prisma.purchase.findUnique({
    where: { stripeSessionId: sessionId },
    select: { productId: true, amountCents: true, currency: true, createdAt: true },
  });
  if (!row) return null;
  return {
    productId: row.productId,
    amountCents: row.amountCents,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getPurchaseByPaymentIntent(
  paymentIntentId: string
): Promise<PurchaseRecord | null> {
  const row = await prisma.purchase.findUnique({
    where: { stripePaymentIntent: paymentIntentId },
    select: { productId: true, amountCents: true, currency: true, createdAt: true },
  });
  if (!row) return null;
  return {
    productId: row.productId,
    amountCents: row.amountCents,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPurchasesForUser(
  userId: string
): Promise<PurchaseRecord[]> {
  const rows = await prisma.purchase.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { productId: true, amountCents: true, currency: true, createdAt: true },
  });
  return rows.map((row) => ({
    productId: row.productId,
    amountCents: row.amountCents,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Inserts a purchase row exactly once per checkout session or payment intent.
 * Returns true if this call is the one that created the record,
 * false when the payment was already recorded (idempotent replay).
 */
export async function insertPurchase(input: {
  userId: string;
  productId: string;
  stripeSessionId: string | null;
  stripePaymentIntent: string | null;
  amountCents: number;
  currency: string;
}): Promise<boolean> {
  try {
    await prisma.purchase.create({
      data: {
        userId: input.userId,
        productId: input.productId,
        stripeSessionId: input.stripeSessionId,
        stripePaymentIntent: input.stripePaymentIntent,
        amountCents: input.amountCents,
        currency: input.currency,
      },
    });
    return true;
  } catch (error) {
    if (isUniqueConstraintViolation(error)) return false;
    throw error;
  }
}

/**
 * When payment_intent.succeeded arrives before checkout.session.completed,
 * the row is created without a session id. This backfills it so the hosted
 * Checkout success page can still look the purchase up by session id.
 */
export async function attachSessionIdToPurchase(
  paymentIntentId: string,
  sessionId: string
): Promise<void> {
  await prisma.purchase.updateMany({
    where: { stripePaymentIntent: paymentIntentId, stripeSessionId: null },
    data: { stripeSessionId: sessionId },
  });
}
