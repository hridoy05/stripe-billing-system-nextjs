import { prisma, isUniqueConstraintViolation } from "@/lib/db";

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

/**
 * Releases an event claim when processing failed so Stripe's retry can be
 * processed instead of being mistaken for an already-handled duplicate.
 */
export async function releaseWebhookEvent(eventId: string): Promise<void> {
  await prisma.stripeEvent.deleteMany({ where: { id: eventId } });
}
