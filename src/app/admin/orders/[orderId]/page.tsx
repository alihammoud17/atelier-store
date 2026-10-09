import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusLabel } from "@/components/account/order-status";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Heading } from "@/components/ui";
import { formatPrice } from "@/lib/catalog";
import { formatOrderDate, orderReference, STORE_TIME_ZONE } from "@/lib/checkout";
import { getAdminOrder } from "@/lib/orders";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Order · Admin",
};

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: STORE_TIME_ZONE }).format(date);
}

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[orderId]">) {
  await requireAdmin();
  const order = await getAdminOrder((await params).orderId);
  if (!order) notFound();

  const pieces = order.items.reduce((total, item) => total + item.quantity, 0);
  const shipping = order.shippingDetails;
  const timeline = [
    { label: "Placed", date: order.createdAt },
    { label: "Paid", date: order.paidAt },
    { label: "Stock released", date: order.stockReleasedAt },
    { label: "Last updated", date: order.updatedAt },
  ];

  return (
    <section aria-labelledby="order-title" className="container-content py-section">
      <AdminPageHeader
        eyebrow={
          <Link href="/admin/orders" className="link-reveal">
            Orders
          </Link>
        }
        title={`Order ${orderReference(order.id)}`}
        titleId="order-title"
        actions={<OrderStatusLabel status={order.status} />}
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-16">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="order-items-title">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <Heading as="h2" id="order-items-title" size="lg">
                Items
              </Heading>
              <span className="text-sm text-ink-muted">{pieces === 1 ? "1 piece" : `${pieces} pieces`}</span>
            </div>
            <ul role="list" aria-labelledby="order-items-title" className="divide-y border-y border-line">
              {order.items.map((item) => (
                <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 py-4 text-sm">
                  {item.productId ? (
                    <Link href={`/admin/products/${item.productId}`} className="link-reveal self-start">
                      {item.productName}
                    </Link>
                  ) : (
                    <span>
                      {item.productName} <span className="text-ink-muted">(deleted)</span>
                    </span>
                  )}
                  <span className="row-span-2 text-right tabular-nums">
                    {formatPrice(item.unitPriceCents * item.quantity)}
                  </span>
                  <span className="text-ink-muted tabular-nums">
                    {item.quantity} × {formatPrice(item.unitPriceCents)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 flex flex-col gap-2 text-sm sm:ml-auto sm:max-w-xs">
              <div className="flex justify-between gap-4">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatPrice(order.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-2 font-medium">
                <dt>Total ({order.currency.toUpperCase()})</dt>
                <dd className="tabular-nums">{formatPrice(order.totalCents)}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="order-timeline-title">
            <Heading as="h2" id="order-timeline-title" size="lg" className="mb-4">
              Timeline
            </Heading>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
              {timeline.map(({ label, date }) => (
                <div key={label} className="contents">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd>{date ? <time dateTime={date.toISOString()}>{formatTimestamp(date)}</time> : "—"}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside aria-labelledby="order-customer-title" className="flex flex-col gap-6 self-start bg-surface p-6 text-sm">
          <Heading as="h2" id="order-customer-title" size="lg">
            Customer
          </Heading>
          <dl className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <dt className="text-label text-ink-muted">Account</dt>
              <dd className="break-all">{order.user ? `${order.user.name} (${order.user.email})` : "Guest checkout"}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-label text-ink-muted">Receipt email</dt>
              <dd className="break-all">{order.email ?? "—"}</dd>
            </div>
            {shipping && (
              <div className="flex flex-col gap-1">
                <dt className="text-label text-ink-muted">Ship to</dt>
                <dd>
                  <address className="not-italic">
                    {[
                      shipping.name,
                      shipping.address.line1,
                      shipping.address.line2,
                      [shipping.address.city, shipping.address.state, shipping.address.postalCode].filter(Boolean).join(", "),
                      shipping.address.country,
                    ]
                      .filter(Boolean)
                      .map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                  </address>
                </dd>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <dt className="text-label text-ink-muted">Payment intent</dt>
              <dd className="font-mono text-xs break-all">{order.stripePaymentIntentId ?? "—"}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-label text-ink-muted">Checkout session</dt>
              <dd className="font-mono text-xs break-all">{order.stripeCheckoutSessionId ?? "—"}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-label text-ink-muted">Order ID</dt>
              <dd className="font-mono text-xs break-all">{order.id}</dd>
            </div>
          </dl>
          <p className="text-ink-muted">Placed {formatOrderDate(order.createdAt)}</p>
        </aside>
      </div>
    </section>
  );
}
