"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Spinner, Text } from "@/components/ui";

const INTERVAL_MS = 2_000;
const MAX_ATTEMPTS = 15;

/**
 * While an order is still pending, re-renders the confirmation page every couple of seconds.
 * Each render asks Stripe for the session again; nothing is decided in the browser. Gives up
 * after ~30s and offers a manual check instead.
 */
export function PaymentStatusPoller() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const waiting = attempts < MAX_ATTEMPTS;

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => {
      router.refresh();
      setAttempts((value) => value + 1);
    }, INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [attempts, waiting, router]);

  if (waiting) {
    return (
      <div role="status" className="flex items-center gap-3 text-sm text-ink-muted">
        <Spinner />
        Checking with our payment provider&hellip;
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <Text size="sm" tone="muted" role="status">
        This is taking longer than usual. If you completed payment, your order is safe: it will
        be confirmed as soon as we hear back.
      </Text>
      <Button variant="secondary" onClick={() => setAttempts(0)}>
        Check again
      </Button>
    </div>
  );
}
