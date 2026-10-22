"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { getOrCreateLocalCustomer } from "@/lib/customers";
import {
  SAVE_CARD_CONSENT_TEXT,
  SAVE_CARD_CONSENT_VERSION,
} from "@/lib/consent";
import { getRequestClient } from "@/lib/request";
import {
  getSavedCardBySetupIntent,
  getSavedCardForUser,
  removeSavedPaymentMethod,
  setDefaultSavedPaymentMethod,
} from "@/lib/saved-cards";

async function createPaymentConsent(input: {
  id: string;
  userId: string;
  customerId: string;
  setupIntentId: string;
  consentVersion: string;
  consentText: string;
  allowOffSession: boolean;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<void> {
  await prisma.paymentConsent.create({
    data: {
      id: input.id,
      userId: input.userId,
      customerId: input.customerId,
      setupIntentId: input.setupIntentId,
      consentVersion: input.consentVersion,
      consentText: input.consentText,
      allowOffSession: input.allowOffSession,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  });
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export type CreateSetupIntentResult =
  | { ok: true; clientSecret: string; setupIntentId: string }
  | { ok: false; error: string };

export type SetupIntentStatus =
  | { status: "saved"; last4: string | null }
  | { status: "pending" };

export async function createSetupIntent(
  consentAccepted: boolean
): Promise<CreateSetupIntentResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "You must be signed in to save a card." };
  }
  if (consentAccepted !== true) {
    return {
      ok: false,
      error: "Please accept the authorization before saving a card.",
    };
  }

  const customer = await getOrCreateLocalCustomer(session.userId);
  const stripe = getStripe();
  const { ipAddress, userAgent } = await getRequestClient();

  // The consent id is generated up front so it can ride in SetupIntent
  // metadata, but the row itself is only persisted once the SetupIntent
  // exists — abandoned/failing attempts do not mint consent records.
  const consentId = crypto.randomUUID();

  try {
    const setupIntent = await stripe.setupIntents.create(
      {
        customer: customer.stripeCustomerId,
        usage: "off_session",
        allowed_payment_method_types: ["card"],
        metadata: {
          userId: session.userId,
          consentId,
          localCustomerId: customer.id,
        },
      },
      {
        idempotencyKey: `setup-intent:${consentId}`,
      }
    );

    if (!setupIntent.client_secret) {
      return { ok: false, error: "Stripe did not return a client secret." };
    }

    await createPaymentConsent({
      id: consentId,
      userId: session.userId,
      customerId: customer.id,
      setupIntentId: setupIntent.id,
      consentVersion: SAVE_CARD_CONSENT_VERSION,
      consentText: SAVE_CARD_CONSENT_TEXT,
      allowOffSession: true,
      ipAddress,
      userAgent,
    });

    return {
      ok: true,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    };
  } catch (error) {
    console.error("Failed to create SetupIntent:", error);
    return { ok: false, error: "Could not start card setup. Please try again." };
  }
}

export async function getSetupIntentStatus(
  setupIntentId: string
): Promise<SetupIntentStatus> {
  const session = await getSession();
  if (!session) return { status: "pending" };

  const card = await getSavedCardBySetupIntent(session.userId, setupIntentId);
  if (!card) return { status: "pending" };
  return { status: "saved", last4: card.last4 };
}

export async function setDefaultPaymentMethod(
  paymentMethodId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  try {
    await setDefaultSavedPaymentMethod(session.userId, paymentMethodId);
    revalidatePath("/account/payment-methods");
    return { ok: true };
  } catch (error) {
    console.error("Failed to set default payment method:", error);
    return { ok: false, error: "Could not update the default card." };
  }
}

export async function removePaymentMethod(
  paymentMethodId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const card = await getSavedCardForUser(session.userId, paymentMethodId);
  if (!card) return { ok: false, error: "Saved card not found." };

  try {
    const stripe = getStripe();
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== card.stripeCustomerId) {
      return { ok: false, error: "Saved card does not belong to this account." };
    }

    await stripe.paymentMethods.detach(paymentMethodId);
    await removeSavedPaymentMethod(paymentMethodId);
    revalidatePath("/account/payment-methods");
    return { ok: true };
  } catch (error) {
    console.error("Failed to remove payment method:", error);
    return { ok: false, error: "Could not remove the saved card." };
  }
}
