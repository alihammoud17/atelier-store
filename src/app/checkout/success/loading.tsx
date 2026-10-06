import { Eyebrow, Heading, Spinner } from "@/components/ui";

// Shown while the confirmation page asks Stripe for the session after the redirect back.
export default function CheckoutSuccessLoading() {
  return (
    <main id="main" className="flex-1">
      <section aria-busy="true" className="container-content py-section">
        <div className="mb-8 flex flex-col gap-3 border-b border-line pb-8">
          <Eyebrow className="text-ink-muted">Checkout</Eyebrow>
          <Heading as="h1" size="3xl">
            Confirming your order
          </Heading>
        </div>
        <div role="status" className="flex items-center gap-3 text-sm text-ink-muted">
          <Spinner />
          Checking your payment with Stripe&hellip;
        </div>
        <div aria-hidden="true" className="mt-8 h-48 bg-surface motion-safe:animate-pulse" />
      </section>
    </main>
  );
}
