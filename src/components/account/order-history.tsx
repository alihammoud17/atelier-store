import Link from "next/link";
import { ButtonLink, Heading, Text } from "@/components/ui";
import { ArrowRightIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/catalog";
import { formatOrderDate, type OrderStatus, orderReference } from "@/lib/checkout";
import { OrderStatusLabel } from "./order-status";

export type OrderSummary = {
  id: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
  items: { quantity: number }[];
};

/** The customer's orders, newest first. Each row links to the order's detail page. */
export function OrderHistory({ orders }: { orders: OrderSummary[] }) {
  return (
    <section aria-labelledby="orders-title" className="flex flex-col gap-6">
      <Heading as="h2" id="orders-title" size="lg">
        Order history
      </Heading>

      {orders.length === 0 ? (
        <div className="flex flex-col items-start gap-4 border border-line p-6">
          <Text tone="muted">You haven&rsquo;t placed any orders yet.</Text>
          <ButtonLink href="/collections/new-in" variant="secondary" size="sm">
            Shop new arrivals
          </ButtonLink>
        </div>
      ) : (
        <ul role="list" className="divide-y border-y border-line">
          {orders.map((order) => {
            const pieces = order.items.reduce((total, item) => total + item.quantity, 0);
            return (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 py-5 transition-colors hover:bg-surface sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:px-3"
                >
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-medium">
                      <span className="sr-only">Order </span>
                      {orderReference(order.id)}
                    </span>
                    <span className="text-sm text-ink-muted">
                      <time dateTime={order.createdAt.toISOString()}>{formatOrderDate(order.createdAt)}</time>
                      <span aria-hidden="true"> · </span>
                      {pieces === 1 ? "1 piece" : `${pieces} pieces`}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums sm:text-right">
                    <span className="sr-only">Total </span>
                    {formatPrice(order.totalCents)}
                  </span>
                  <OrderStatusLabel status={order.status} className="col-span-2 sm:col-span-1" />
                  <span className="text-label hidden items-center gap-2 sm:inline-flex">
                    View
                    <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
