"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { startCheckout } from "@/app/checkout/actions";
import { Button, Spinner } from "@/components/ui";
import type { CheckoutActionState } from "@/lib/checkout";

/**
 * Submits the bag to `startCheckout`, which redirects to Stripe or returns why it couldn't.
 * Remounts when the page comes back from the back/forward cache (Back from Stripe), so the
 * button isn't left showing a stale "Redirecting" state.
 */
export function CheckoutButton({ disabled = false }: { disabled?: boolean }) {
  const [generation, setGeneration] = useState(0);
  const router = useRouter();

  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      setGeneration((value) => value + 1);
      // Re-read the bag: the checkout that was started holds stock until it's cancelled.
      router.refresh();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [router]);

  return <CheckoutForm key={generation} disabled={disabled} />;
}

async function submit(): Promise<CheckoutActionState> {
  try {
    return await startCheckout();
  } catch {
    // The request itself failed (offline, server unreachable). A redirect never lands here.
    return { message: "We couldn't reach the store. Check your connection and try again." };
  }
}

function CheckoutForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(submit, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.refresh) router.refresh();
  }, [state, router]);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        // Actions queue rather than drop, so block repeat submits while one is in flight.
        if (pending) event.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      {/* Not disabled while pending: the btn styles fade disabled buttons like an unavailable action. */}
      <Button type="submit" block disabled={disabled} aria-busy={pending || undefined}>
        {pending ? (
          <>
            <Spinner />
            Preparing secure checkout
          </>
        ) : (
          "Checkout"
        )}
      </Button>
      <p aria-live="polite" className="sr-only">
        {pending ? "Preparing secure checkout. You'll be redirected to Stripe to pay." : ""}
      </p>
      {state && !pending && (
        <p role="alert" className="border border-danger px-4 py-3 text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
