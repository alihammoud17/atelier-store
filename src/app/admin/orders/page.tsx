import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusLabel } from "@/components/account/order-status";
import { AdminCell, AdminRow, AdminTable } from "@/components/admin/admin-table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Text } from "@/components/ui";
import { formatPrice } from "@/lib/catalog";
import { formatOrderDate, type OrderStatus, orderReference, orderStatusLabels } from "@/lib/checkout";
import { getAdminOrders } from "@/lib/orders";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Orders · Admin",
};

/** Statuses a placed order can have; open and abandoned checkouts aren't listed. */
const filters: OrderStatus[] = ["paid", "processing", "needs_review", "failed"];
const LIMIT = 200;

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const requested = (await searchParams).status;
  // Anything but a known placed status shows all orders.
  const status = filters.find((filter) => filter === requested);
  const orders = await getAdminOrders({ status, limit: LIMIT });

  return (
    <section aria-labelledby="orders-title" className="container-content py-section">
      <AdminPageHeader
        eyebrow={orders.length === LIMIT ? `Latest ${LIMIT}` : orders.length === 1 ? "1 order" : `${orders.length} orders`}
        title="Orders"
        titleId="orders-title"
      />

      <nav aria-label="Filter by status" className="mb-8">
        <ul role="list" className="flex flex-wrap gap-x-6 gap-y-3">
          {[undefined, ...filters].map((filter) => (
            <li key={filter ?? "all"}>
              <Link
                href={filter ? `/admin/orders?status=${filter}` : "/admin/orders"}
                aria-current={filter === status ? "page" : undefined}
                className="text-label link-reveal"
              >
                {filter ? orderStatusLabels[filter] : "All"}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {orders.length === 0 ? (
        <Text tone="muted">{status ? "No orders with this status." : "No orders yet."}</Text>
      ) : (
        <AdminTable
          caption="Placed orders, newest first"
          columns={[
            { label: "Order" },
            { label: "Placed" },
            { label: "Customer" },
            { label: "Pieces", className: "text-right" },
            { label: "Total", className: "text-right" },
            { label: "Status" },
          ]}
        >
          {orders.map((order) => {
            const pieces = order.items.reduce((total, item) => total + item.quantity, 0);
            return (
              <AdminRow key={order.id}>
                <AdminCell>
                  <Link href={`/admin/orders/${order.id}`} className="link-reveal self-start font-medium tabular-nums">
                    {orderReference(order.id)}
                  </Link>
                </AdminCell>
                <AdminCell label="Placed" className="text-ink-muted">
                  <time dateTime={order.createdAt.toISOString()}>{formatOrderDate(order.createdAt)}</time>
                </AdminCell>
                <AdminCell label="Customer" className="col-span-2 sm:col-span-1">
                  <span className="block break-all">{order.user?.name ?? "Guest"}</span>
                  <span className="block text-ink-muted break-all">{order.email ?? order.user?.email}</span>
                </AdminCell>
                <AdminCell label="Pieces" className="tabular-nums sm:text-right">
                  {pieces}
                </AdminCell>
                <AdminCell label="Total" className="tabular-nums sm:text-right">
                  {formatPrice(order.totalCents)}
                </AdminCell>
                <AdminCell label="Status" className="col-span-2 sm:col-span-1">
                  <OrderStatusLabel status={order.status} />
                </AdminCell>
              </AdminRow>
            );
          })}
        </AdminTable>
      )}
    </section>
  );
}
