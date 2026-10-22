import { prisma, isUniqueConstraintViolation } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export type LocalStripeCustomer = {
  id: string;
  userId: string;
  stripeCustomerId: string;
  defaultPaymentMethodId: string | null;
};

function mapCustomer(row: {
  id: string;
  userId: string;
  stripeCustomerId: string;
  defaultPaymentMethodId: string | null;
}): LocalStripeCustomer {
  return {
    id: row.id,
    userId: row.userId,
    stripeCustomerId: row.stripeCustomerId,
    defaultPaymentMethodId: row.defaultPaymentMethodId,
  };
}

export async function getLocalCustomer(
  userId: string
): Promise<LocalStripeCustomer | null> {
  const row = await prisma.stripeCustomer.findUnique({ where: { userId } });
  return row ? mapCustomer(row) : null;
}

/**
 * Returns the Stripe Customer mapped to this application user, creating one
 * on first use. The mapping lives in our database so a user can never access
 * another user's Stripe Customer.
 */
export async function getOrCreateLocalCustomer(
  userId: string
): Promise<LocalStripeCustomer> {
  const existing = await getLocalCustomer(userId);
  if (existing) return existing;

  const stripe = getStripe();
  const created = await stripe.customers.create({
    description: `Stripe payments customer for ${userId}`,
    metadata: { userId },
  });

  try {
    const row = await prisma.stripeCustomer.create({
      data: {
        userId,
        stripeCustomerId: created.id,
      },
    });
    return mapCustomer(row);
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      const row = await prisma.stripeCustomer.findUnique({ where: { userId } });
      if (row) return mapCustomer(row);
    }
    throw error;
  }
}
