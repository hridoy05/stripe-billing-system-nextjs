import { getSetupIntentStatus } from "@/actions/payment-methods";

export async function waitForSavedCard(
  setupIntentId: string
): Promise<boolean> {
  const schedule = [...Array(12).fill(1000), ...Array(10).fill(3000)];
  for (const delay of schedule) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    const result = await getSetupIntentStatus(setupIntentId);
    if (result.status === "saved") return true;
  }
  return false;
}
