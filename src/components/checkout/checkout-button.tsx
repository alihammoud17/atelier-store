"use client";

import { useActionState } from "react";
import { startCheckout } from "@/app/checkout/actions";
import { Button } from "@/components/ui";

/** Submits the bag to `startCheckout`, which redirects to Stripe or returns why it couldn't. */
export function CheckoutButton({ disabled = false }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState(startCheckout, null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <Button type="submit" block disabled={disabled || pending} aria-disabled={pending || undefined}>
        {pending ? "Starting checkout…" : "Checkout"}
      </Button>
      {state && !pending && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
