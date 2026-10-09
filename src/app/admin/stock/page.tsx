import type { Metadata } from "next";
import Link from "next/link";
import { AdminCell, AdminRow, AdminTable } from "@/components/admin/admin-table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StockForm } from "@/components/admin/stock-form";
import { Text } from "@/components/ui";
import { getStockOverview } from "@/lib/admin-catalog";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Stock · Admin",
};

export default async function AdminStockPage() {
  await requireAdmin();
  const rows = await getStockOverview();
  const soldOut = rows.filter((row) => row.available === 0).length;

  return (
    <section aria-labelledby="stock-title" className="container-content py-section">
      <AdminPageHeader
        eyebrow={soldOut > 0 ? `${soldOut} sold out` : "Everything in stock"}
        title="Stock"
        titleId="stock-title"
      />
      <Text size="sm" tone="muted" className="mb-8 max-w-2xl">
        Available is what shoppers can buy now. Units in open checkouts are already taken off and come
        back automatically if the checkout isn&rsquo;t paid, so set available to what you can sell on top
        of them.
      </Text>

      {rows.length === 0 ? (
        <Text tone="muted">No products yet.</Text>
      ) : (
        <AdminTable
          caption="Stock by product"
          columns={[
            { label: "Product" },
            { label: "Category" },
            { label: "In open checkouts", className: "text-right" },
            { label: "Available" },
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
              <AdminCell label="In open checkouts" className="tabular-nums sm:text-right">
                {row.reserved}
              </AdminCell>
              <AdminCell label="Available" className="col-span-2 sm:col-span-1">
                <StockForm productId={row.productId} productName={row.name} available={row.available} />
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </section>
  );
}
