import { buttonClasses, Eyebrow, Heading, Text } from "@/components/ui";
import { formatPrice } from "@/lib/catalog";
import type { OpenCheckout } from "@/lib/orders";

/**
 * Shown on /bag instead of the editable bag while this browser has an unpaid Stripe session,
 * typically after pressing Back on the payment page. The pieces are reserved for that session,
 * so the shopper either returns to it or cancels it to edit the bag.
 */
export function OpenCheckoutPanel({ checkout }: { checkout: OpenCheckout }) {
  const minutes = checkout.minutesLeft === 1 ? "1 more minute" : `${checkout.minutesLeft} more minutes`;

  return (
    <section
      aria-labelledby="open-checkout-title"
      className="grid gap-8 border border-line p-6 md:p-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-16"
    >
      <div className="flex flex-col gap-4">
        <Eyebrow className="text-ink-muted">Checkout in progress</Eyebrow>
        <Heading as="h2" id="open-checkout-title" size="2xl">
          Your pieces are reserved
        </Heading>
        <Text tone="muted" className="max-w-prose">
          We&rsquo;re holding them for you for {minutes} while you complete payment. You
          haven&rsquo;t been charged. To change your bag, cancel this checkout first.
        </Text>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          {/* Plain anchors: the payment page is external, and the cancel link is a route handler
              that must never be prefetched. */}
          {checkout.url && (
            <a href={checkout.url} className={buttonClasses()}>
              Return to payment
            </a>
          )}
          <a
            href={`/checkout/cancel?order=${checkout.orderId}`}
            className={buttonClasses({ variant: checkout.url ? "secondary" : "primary" })}
          >
            Cancel checkout
          </a>
        </div>
        {!checkout.url && (
          <Text size="sm" tone="muted">
            We can&rsquo;t reach the payment page right now. Cancel and start checkout again, or
            wait and refresh this page.
          </Text>
        )}
      </div>

      <div className="flex flex-col gap-4 bg-surface p-6">
        <Heading as="h3" size="lg">
          Reserved for you
        </Heading>
        <ul role="list" className="divide-y border-y border-line">
          {checkout.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
              <span className="min-w-0">{item.productName}</span>
              <span className="shrink-0 text-ink-muted tabular-nums">&times; {item.quantity}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between gap-4 text-sm font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(checkout.totalCents)}</span>
        </div>
      </div>
    </section>
  );
}
