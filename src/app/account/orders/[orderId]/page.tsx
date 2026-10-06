import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderProgress } from "@/components/account/order-progress";
import { OrderStatusLabel } from "@/components/account/order-status";
import { CatalogImage, Eyebrow, Heading, MediaFrame, Text } from "@/components/ui";
import { formatPrice } from "@/lib/catalog";
import { formatOrderDate, orderReference } from "@/lib/checkout";
import { getCustomerOrder } from "@/lib/orders";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false },
};

export default async function OrderDetailsPage({ params }: PageProps<"/account/orders/[orderId]">) {
  const { orderId } = await params;
  const { user } = await requireSession(`/account/orders/${orderId}`);
  // Scoped to the signed-in customer: someone else's order is a 404, not a 403.
  const order = await getCustomerOrder(user.id, orderId);
  if (!order) notFound();

  const pieces = order.items.reduce((total, item) => total + item.quantity, 0);
  const shipping = order.shippingDetails;

  return (
    <main id="main" className="flex-1">
      <div className="container-content pt-6 md:pt-8">
        <nav aria-label="Breadcrumb" className="text-2xs tracking-wide text-ink-muted uppercase">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/account" className="link-reveal">Account</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Order {orderReference(order.id)}</li>
          </ol>
        </nav>
      </div>

      <section aria-labelledby="order-title" className="container-content pt-8 pb-section md:pt-12">
        <header className="mb-8 flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <Eyebrow className="text-ink-muted">
              Placed <time dateTime={order.createdAt.toISOString()}>{formatOrderDate(order.createdAt)}</time>
            </Eyebrow>
            <Heading as="h1" id="order-title" size="3xl">
              Order {orderReference(order.id)}
            </Heading>
          </div>
          <OrderStatusLabel status={order.status} />
        </header>

        <div className="mb-10">
          <OrderProgress order={order} />
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <Heading as="h2" id="order-items-title" size="lg">
                Items
              </Heading>
              <Text size="sm" tone="muted">
                {pieces === 1 ? "1 piece" : `${pieces} pieces`}
              </Text>
            </div>
            <ul role="list" aria-labelledby="order-items-title" className="divide-y border-y border-line">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6"
                >
                  <MediaFrame>
                    {item.product ? (
                      <CatalogImage src={item.product.imageSrc} alt="" fill sizes="6rem" />
                    ) : null}
                  </MediaFrame>
                  <div className="flex min-w-0 flex-col gap-2 text-sm">
                    {item.product ? (
                      <Link href={`/products/${item.product.slug}`} className="link-reveal self-start">
                        {item.productName}
                      </Link>
                    ) : (
                      <span>{item.productName}</span>
                    )}
                    <dl className="flex flex-wrap gap-x-5 gap-y-1 text-ink-muted">
                      <div className="flex gap-1.5">
                        <dt>Qty</dt>
                        <dd className="text-ink tabular-nums">{item.quantity}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt>Price</dt>
                        <dd className="text-ink tabular-nums">{formatPrice(item.unitPriceCents)}</dd>
                      </div>
                      {/* On phones the line total sits with the other figures. */}
                      <div className="flex gap-1.5 sm:hidden">
                        <dt>Total</dt>
                        <dd className="text-ink tabular-nums">
                          {formatPrice(item.unitPriceCents * item.quantity)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <p className="hidden text-right text-sm tabular-nums sm:block">
                    <span className="sr-only">Line total </span>
                    {formatPrice(item.unitPriceCents * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <aside aria-labelledby="order-summary-title" className="flex flex-col gap-6 self-start bg-surface p-6">
            <Heading as="h2" id="order-summary-title" size="lg">
              Summary
            </Heading>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatPrice(order.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between gap-4 text-ink-muted">
                <dt>Shipping</dt>
                <dd>Complimentary</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-3 font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice(order.totalCents)}</dd>
              </div>
            </dl>

            {shipping && (
              <div className="flex flex-col gap-2 border-t border-line pt-6">
                <Eyebrow as="h3" className="text-ink-muted">
                  Shipping to
                </Eyebrow>
                <address className="text-sm not-italic">
                  {shipping.name}
                  {[
                    shipping.address.line1,
                    shipping.address.line2,
                    [shipping.address.city, shipping.address.state, shipping.address.postalCode]
                      .filter(Boolean)
                      .join(", "),
                    shipping.address.country,
                  ]
                    .filter(Boolean)
                    .map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                </address>
              </div>
            )}
            {order.email && (
              <Text size="sm" tone="muted" className="break-all">
                Receipt contact: {order.email}
              </Text>
            )}
          </aside>
        </div>

        <div className="mt-12">
          <Link href="/account" className="text-label link-reveal">
            Back to account
          </Link>
        </div>
      </section>
    </main>
  );
}
