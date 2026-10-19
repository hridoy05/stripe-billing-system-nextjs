import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type GlobalDb = typeof globalThis & {
  __stripePaymentsPrisma?: PrismaClient;
};

const globalDb = globalThis as GlobalDb;

export type PurchaseRecord = {
  productId: string;
  amountCents: number;
  currency: string;
  createdAt: string;
};

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2002";
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
} else {
  prisma =
    globalDb.__stripePaymentsPrisma ??
    new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      }),
    });

  globalDb.__stripePaymentsPrisma = prisma;
}

export { prisma };

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
 * Inserts a purchase row exactly once per checkout session.
 * Returns true if this call is the one that created the record,
 * false when the session was already recorded (idempotent replay).
 */
export async function insertPurchase(input: {
  userId: string;
  productId: string;
  stripeSessionId: string;
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
 * Deduplicates webhook deliveries by Stripe event id.
 * Returns true only for the first delivery of a given event.
 */
export async function claimWebhookEvent(eventId: string): Promise<boolean> {
  try {
    await prisma.stripeEvent.create({ data: { id: eventId } });
    return true;
  } catch (error) {
    if (isUniqueConstraintViolation(error)) return false;
    throw error;
  }
}
