"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPurchaseStatus, type PurchaseStatus } from "@/app/actions/purchases";

export function PaymentConfirmation({
  sessionId,
  initialStatus,
}: {
  sessionId: string;
  initialStatus: PurchaseStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<PurchaseStatus>(initialStatus);

  useEffect(() => {
    if (status === "purchased") return;

    let cancelled = false;
    const attempts = 20;

    (async () => {
      for (let i = 0; i < attempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (cancelled) return;
        const next = await getPurchaseStatus(sessionId);
        if (cancelled) return;
        if (next === "purchased") {
          setStatus("purchased");
          router.refresh();
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, status, router]);

  if (status === "purchased") {
    return (
      <span className="rounded-full bg-green-100 px-4 py-1 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
        Payment confirmed — access granted
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-100 px-4 py-1 text-sm font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
      Verifying payment…
    </span>
  );
}
