import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export type SavedCard = {
  id: string;
  type: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  billingName: string | null;
  isDefault: boolean;
  allowOffSession: boolean;
  createdAt: string;
};

export type SavedCardRecord = {
  id: string;
  customerId: string;
  isDefault: boolean;
  consentId: string | null;
  stripeCustomerId: string;
  userId: string;
  allowOffSession: boolean;
};

function mapCard(row: {
  id: string;
  type: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  billingName: string | null;
  isDefault: boolean;
  createdAt: Date;
  consent: { allowOffSession: boolean } | null;
}): SavedCard {
  return {
    id: row.id,
    type: row.type,
    brand: row.brand,
    last4: row.last4,
    expMonth: row.expMonth,
    expYear: row.expYear,
    billingName: row.billingName,
    isDefault: row.isDefault,
    allowOffSession: row.consent?.allowOffSession ?? false,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listSavedCards(userId: string): Promise<SavedCard[]> {
  const rows = await prisma.savedPaymentMethod.findMany({
    where: { customer: { userId } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    include: { consent: { select: { allowOffSession: true } } },
  });
  return rows.map(mapCard);
}

export async function getSavedCardForUser(
  userId: string,
  paymentMethodId: string
): Promise<SavedCardRecord | null> {
  const row = await prisma.savedPaymentMethod.findFirst({
    where: {
      id: paymentMethodId,
      customer: { userId },
    },
    include: {
      customer: { select: { stripeCustomerId: true, userId: true } },
      consent: { select: { allowOffSession: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    customerId: row.customerId,
    isDefault: row.isDefault,
    consentId: row.consentId,
    stripeCustomerId: row.customer.stripeCustomerId,
    userId: row.customer.userId,
    allowOffSession: row.consent?.allowOffSession ?? false,
  };
}

export async function getSavedCardBySetupIntent(
  userId: string,
  setupIntentId: string
): Promise<SavedCard | null> {
  const row = await prisma.savedPaymentMethod.findFirst({
    where: {
      setupIntentId,
      customer: { userId },
    },
    include: { consent: { select: { allowOffSession: true } } },
  });
  return row ? mapCard(row) : null;
}

async function setStripeDefaultPaymentMethod(
  stripeCustomerId: string,
  paymentMethodId: string | null
): Promise<void> {
  const stripe = getStripe();
  await stripe.customers.update(stripeCustomerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId ?? "",
    },
  });
}

/**
 * Mirrors a SetupIntent result from a verified webhook into our database.
 * The webhook is the source of truth: nothing is saved based on the browser
 * success message alone.
 */
export async function syncSetupIntentPaymentMethod(
  intent: Stripe.SetupIntent
): Promise<void> {
  const { userId, consentId } = intent.metadata ?? {};
  if (!userId || !consentId) {
    console.error(
      `SetupIntent ${intent.id} is missing userId/consentId metadata; not saving.`
    );
    return;
  }

  if (intent.status !== "succeeded") {
    console.error(
      `SetupIntent ${intent.id} is not succeeded (${intent.status}); not saving.`
    );
    return;
  }

  const stripeCustomerId =
    typeof intent.customer === "string" ? intent.customer : null;
  const paymentMethodId =
    typeof intent.payment_method === "string" ? intent.payment_method : null;

  if (!stripeCustomerId || !paymentMethodId) {
    console.error(
      `SetupIntent ${intent.id} is missing a customer or payment method; not saving.`
    );
    return;
  }

  const customer = await prisma.stripeCustomer.findFirst({
    where: { userId, stripeCustomerId },
  });
  if (!customer) {
    console.error(
      `SetupIntent ${intent.id}: no local customer for user=${userId}.`
    );
    return;
  }

  const consent = await prisma.paymentConsent.findUnique({
    where: { id: consentId },
  });
  if (
    !consent ||
    consent.userId !== userId ||
    consent.customerId !== customer.id
  ) {
    console.error(
      `SetupIntent ${intent.id}: consent ${consentId} does not belong to this customer; not saving.`
    );
    return;
  }
  if (consent.setupIntentId && consent.setupIntentId !== intent.id) {
    console.error(
      `SetupIntent ${intent.id}: consent ${consentId} is linked to a different SetupIntent; not saving.`
    );
    return;
  }

  const stripe = getStripe();
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (paymentMethod.customer !== stripeCustomerId) {
    // Save is refused; treated as a permanent condition so the event is not
    // retried forever. No card data is persisted.
    console.error(
      `SetupIntent ${intent.id}: PaymentMethod ${paymentMethodId} does not belong to customer ${stripeCustomerId}`
    );
    return;
  }

  const card = paymentMethod.card;
  const data = {
    customerId: customer.id,
    setupIntentId: intent.id,
    consentId: consent.id,
    type: paymentMethod.type,
    brand: card?.brand ?? null,
    last4: card?.last4 ?? null,
    expMonth: card?.exp_month ?? null,
    expYear: card?.exp_year ?? null,
    billingName: paymentMethod.billing_details?.name ?? null,
  };

  const { shouldUpdateStripeDefault } = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.savedPaymentMethod.findUnique({
        where: { id: paymentMethod.id },
      });

      if (existing) {
        await tx.savedPaymentMethod.update({
          where: { id: paymentMethod.id },
          data,
        });
        return { shouldUpdateStripeDefault: existing.isDefault };
      }

      const claimedDefault = await tx.stripeCustomer.updateMany({
        where: { id: customer.id, defaultPaymentMethodId: null },
        data: { defaultPaymentMethodId: paymentMethod.id },
      });
      const isDefault = claimedDefault.count === 1;

      await tx.savedPaymentMethod.create({
        data: {
          id: paymentMethod.id,
          ...data,
          isDefault,
        },
      });

      return { shouldUpdateStripeDefault: isDefault };
    }
  );

  if (shouldUpdateStripeDefault) {
    await setStripeDefaultPaymentMethod(stripeCustomerId, paymentMethod.id);
  }

  console.log(
    `Saved payment method ${paymentMethod.id} (${paymentMethod.type}) for user=${userId}`
  );
}

/**
 * Deletes a saved card and, if it was the default, promotes the next card.
 * Also clears/updates the default on the Stripe Customer.
 */
export async function removeSavedPaymentMethod(
  paymentMethodId: string
): Promise<boolean> {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.savedPaymentMethod.findUnique({
      where: { id: paymentMethodId },
      include: { customer: { select: { stripeCustomerId: true } } },
    });
    if (!existing) return null;

    await tx.savedPaymentMethod.delete({ where: { id: paymentMethodId } });

    if (!existing.isDefault) {
      return {
        stripeCustomerId: existing.customer.stripeCustomerId,
        changedDefault: false,
        nextId: null as string | null,
      };
    }

    const next = await tx.savedPaymentMethod.findFirst({
      where: { customerId: existing.customerId },
      orderBy: { createdAt: "desc" },
    });

    await tx.stripeCustomer.update({
      where: { id: existing.customerId },
      data: { defaultPaymentMethodId: next?.id ?? null },
    });

    if (next) {
      await tx.savedPaymentMethod.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }

    return {
      stripeCustomerId: existing.customer.stripeCustomerId,
      changedDefault: true,
      nextId: next?.id ?? null,
    };
  });

  if (!result) return false;

  if (result.changedDefault) {
    try {
      await setStripeDefaultPaymentMethod(result.stripeCustomerId, result.nextId);
    } catch (error) {
      // The DB promotion already committed; retry the Stripe-side promotion
      // once so a transient API failure does not leave the customer without
      // a default. Retried webhook deliveries replay here idempotently.
      console.error(
        `Could not promote default on Stripe customer ${result.stripeCustomerId}; retrying once`,
        error
      );
      await setStripeDefaultPaymentMethod(result.stripeCustomerId, result.nextId);
    }
  }

  return true;
}

export async function setDefaultSavedPaymentMethod(
  userId: string,
  paymentMethodId: string
): Promise<void> {
  const card = await getSavedCardForUser(userId, paymentMethodId);
  if (!card) {
    throw new Error("Saved card not found");
  }

  const stripe = getStripe();
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (paymentMethod.customer !== card.stripeCustomerId) {
    throw new Error("Saved card does not belong to this customer");
  }

  await setStripeDefaultPaymentMethod(card.stripeCustomerId, paymentMethodId);

  await prisma.$transaction([
    prisma.savedPaymentMethod.updateMany({
      where: { customerId: card.customerId },
      data: { isDefault: false },
    }),
    prisma.savedPaymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: true },
    }),
    prisma.stripeCustomer.update({
      where: { id: card.customerId },
      data: { defaultPaymentMethodId: paymentMethodId },
    }),
  ]);
}
