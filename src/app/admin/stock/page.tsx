import type { Metadata } from "next";
import Link from "next/link";
import { AdjustStockForm } from "@/components/admin/adjust-stock-form";
import { AdminCell, AdminRow, AdminTable } from "@/components/admin/admin-table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StockForm } from "@/components/admin/stock-form";
import { Text } from "@/components/ui";
import { getStockOverview } from "@/lib/admin-catalog";
import { getStockStatus, type StockStatus } from "@/lib/catalog";
import { cx } from "@/lib/cx";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Stock · Admin",
};

/** The storefront's status for the same stock (see StockStatus), in admin words. */
const statusLabels: Record<StockStatus, string> = {
  "in-stock": "In stock",
  "low-stock": "Low",
  "out-of-stock": "Sold out",
};

export default async function AdminStockPage() {
  await requireAdmin();
  const rows = (await getStockOverview()).map((row) => ({ ...row, status: getStockStatus(row.available) }));
  const soldOut = rows.filter((row) => row.status === "out-of-stock").length;
  const low = rows.filter((row) => row.status === "low-stock").length;
  const summary = [soldOut > 0 && `${soldOut} sold out`, low > 0 && `${low} low`].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby="stock-title" className="container-content py-section">
      <AdminPageHeader eyebrow={summary || "Everything in stock"} title="Stock" titleId="stock-title" />
      <Text size="sm" tone="muted" className="mb-8 max-w-2xl">
        Available is what shoppers can buy now. Units in open checkouts are already taken off and come
        back automatically if the checkout isn&rsquo;t paid, so set available to what you can sell on top
        of them. To receive a delivery or write off a piece, add or remove units instead: that applies on
        top of whatever checkouts are doing. Units held for review belong to orders that need checking;
        they stay off stock until the order is resolved.
      </Text>

      {rows.length === 0 ? (
        <Text tone="muted">No products yet.</Text>
      ) : (
        <AdminTable
          caption="Stock by product"
          columns={[
            { label: "Product" },
            { label: "Category" },
            { label: "Status" },
            { label: "In open checkouts", className: "text-right" },
            { label: "Held for review", className: "text-right" },
            { label: "Available" },
            { label: "Add or remove" },
          ]}
        >
          {rows.map((row) => (
            <AdminRow key={row.productId}>
              <AdminCell className="col-span-2 sm:col-span-1">
                <Link href={`/admin/products/${row.productId}`} className="link-reveal self-start font-medium">
                  {row.name}
                </Link>
              </AdminCell>
              <AdminCell label="Category">{row.category}</AdminCell>
              <AdminCell label="Status" className={cx(row.status === "out-of-stock" && "text-danger")}>
                {statusLabels[row.status]}
              </AdminCell>
              <AdminCell label="In open checkouts" className="tabular-nums sm:text-right">
                {row.reserved}
              </AdminCell>
              <AdminCell label="Held for review" className="tabular-nums sm:text-right">
                {row.held}
              </AdminCell>
              <AdminCell label="Available" className="col-span-2 sm:col-span-1">
                <StockForm productId={row.productId} productName={row.name} available={row.available} />
              </AdminCell>
              <AdminCell label="Add or remove" className="col-span-2 sm:col-span-1">
                <AdjustStockForm productId={row.productId} productName={row.name} />
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </section>
  );
}
