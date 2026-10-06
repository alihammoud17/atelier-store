import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClearBagOnSuccess } from "@/components/checkout/clear-bag-on-success";
import { PaymentStatusPoller } from "@/components/checkout/payment-status-poller";
import { ButtonLink, Eyebrow, Heading, Text } from "@/components/ui";
import { formatPrice } from "@/lib/catalog";
import { isCheckoutSessionId, type OrderStatus, orderReference } from "@/lib/checkout";
import { getOrderBySession, syncCheckoutSession } from "@/lib/orders";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false },
};

const copy: Record<OrderStatus, { eyebrow: string; title: string; body: string }> = {
  paid: {
    eyebrow: "Order confirmed",
    title: "Thank you for your order",
    body: "Your payment has been received and your pieces are being prepared.",
  },
  processing: {
    eyebrow: "Payment processing",
    title: "Your order is placed",
    body: "Your bank is still confirming the payment, which can take a few days. Your pieces are held for you until then.",
  },
  pending: {
    eyebrow: "Confirming payment",
    title: "We’re confirming your payment",
    body: "This usually takes a few seconds. You can stay on this page; it updates on its own.",
  },
  needs_review: {
    eyebrow: "Under review",
    title: "We’re reviewing your order",
    body: "We received your payment but need to check a detail of your order. Our team will be in touch.",
  },
  expired: {
    eyebrow: "Checkout not completed",
    title: "This checkout has ended",
    body: "You haven’t been charged. Your bag is still saved if you’d like to try again.",
  },
  failed: {
    eyebrow: "Payment unsuccessful",
    title: "Your payment didn’t go through",
    body: "You haven’t been charged. Your bag is still saved if you’d like to try again.",
  },
};

/**
 * Stripe's success_url. Reaching it proves nothing: the session is retrieved from Stripe on the
 * server and the order is shown as our database records it, which only Stripe's word moves to
 * "paid".
 */
export default async function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  const { session_id: sessionId } = await searchParams;
  const order = isCheckoutSessionId(sessionId) ? await loadOrder(sessionId) : undefined;

  if (!order) {
    return (
      <Shell eyebrow="Checkout" title="We couldn’t find this checkout">
        <Text tone="muted">
          If you completed a payment, it will still be processed. Your bag is saved.
        </Text>
        <Actions primary={{ href: "/bag", label: "Return to bag" }} />
      </Shell>
    );
  }

  const text = copy[order.status];
  const placed = order.status === "paid" || order.status === "processing" || order.status === "needs_review";

  return (
    <Shell eyebrow={text.eyebrow} title={text.title}>
      {order.status === "paid" && <ClearBagOnSuccess orderId={order.id} />}
      <Text tone="muted">{text.body}</Text>

      {placed && (
        <section aria-labelledby="order-summary-title" className="flex flex-col gap-6 bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Heading as="h2" id="order-summary-title" size="lg">
              Order {orderReference(order.id)}
            </Heading>
            {order.email && (
              <Text size="sm" tone="muted" className="break-all">
                {order.email}
              </Text>
            )}
          </div>
          <ul role="list" className="divide-y border-y border-line">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-4 text-sm">
                <span className="min-w-0">
                  {item.productName}
                  <span className="text-ink-muted"> &times; {item.quantity}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatPrice(item.unitPriceCents * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4 text-ink-muted">
              <dt>Shipping</dt>
              <dd>Complimentary</dd>
            </div>
            <div className="flex justify-between gap-4 font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(order.totalCents)}</dd>
            </div>
          </dl>
        </section>
      )}

      {order.status === "pending" ? (
        <PaymentStatusPoller />
      ) : placed ? (
        <Actions primary={{ href: "/", label: "Continue shopping" }} />
      ) : (
        <Actions
          primary={{ href: "/bag", label: "Return to bag" }}
          secondary={{ href: "/", label: "Continue shopping" }}
        />
      )}
    </Shell>
  );
}

async function loadOrder(sessionId: string) {
  try {
    // Covers webhook lag; the webhook applies the same idempotent transition.
    await syncCheckoutSession(sessionId);
  } catch (error) {
    // Stripe unreachable: show what the webhook has recorded so far.
    console.error(`Couldn't sync Checkout Session ${sessionId}`, error);
  }
  return getOrderBySession(sessionId);
}

function Shell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <main id="main" className="flex-1">
      <section aria-labelledby="checkout-title" className="container-content py-section">
        <div className="mb-8 flex flex-col gap-3 border-b border-line pb-8">
          <Eyebrow className="text-ink-muted">{eyebrow}</Eyebrow>
          <Heading as="h1" id="checkout-title" size="3xl" className="break-words">
            {title}
          </Heading>
        </div>
        <div className="flex flex-col gap-8">{children}</div>
      </section>
    </main>
  );
}

type Action = { href: string; label: string };

function Actions({ primary, secondary }: { primary: Action; secondary?: Action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <ButtonLink href={primary.href}>{primary.label}</ButtonLink>
      {secondary && (
        <ButtonLink href={secondary.href} variant="secondary">
          {secondary.label}
        </ButtonLink>
      )}
    </div>
  );
}
