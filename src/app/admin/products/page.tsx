import type { Metadata } from "next";
import Link from "next/link";
import { AdminCell, AdminRow, AdminTable } from "@/components/admin/admin-table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ButtonLink, CatalogImage, MediaFrame, Text } from "@/components/ui";
import { getAdminProducts } from "@/lib/admin-catalog";
import { formatPrice } from "@/lib/catalog";
import { formatOrderDate } from "@/lib/checkout";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Products · Admin",
};

export default async function AdminProductsPage() {
  await requireAdmin();
  const products = await getAdminProducts();

  return (
    <section aria-labelledby="products-title" className="container-content py-section">
      <AdminPageHeader
        eyebrow={products.length === 1 ? "1 product" : `${products.length} products`}
        title="Products"
        titleId="products-title"
        actions={<ButtonLink href="/admin/products/new">New product</ButtonLink>}
      />

      {products.length === 0 ? (
        <Text tone="muted">No products yet. Create the first one to start selling.</Text>
      ) : (
        <AdminTable
          caption="Products, newest first"
          columns={[
            { label: "Image", srOnly: true },
            { label: "Product" },
            { label: "Category" },
            { label: "Price", className: "text-right" },
            { label: "Stock", className: "text-right" },
            { label: "Updated" },
          ]}
        >
          {products.map((product) => (
            <AdminRow key={product.id}>
              <AdminCell className="row-span-2 sm:w-16">
                <MediaFrame className="aspect-product w-14">
                  <CatalogImage src={product.imageSrc} alt="" fill sizes="3.5rem" />
                </MediaFrame>
              </AdminCell>
              <AdminCell>
                <Link href={`/admin/products/${product.id}`} className="link-reveal self-start font-medium">
                  {product.name}
                </Link>
                <span className="block text-ink-muted break-all">/{product.slug}</span>
              </AdminCell>
              <AdminCell label="Category">{product.category}</AdminCell>
              <AdminCell label="Price" className="tabular-nums sm:text-right">
                {formatPrice(product.priceCents)}
              </AdminCell>
              <AdminCell label="Stock" className="tabular-nums sm:text-right">
                <span className={product.stock === 0 ? "text-danger" : undefined}>{product.stock}</span>
              </AdminCell>
              <AdminCell label="Updated" className="text-ink-muted">
                <time dateTime={product.updatedAt.toISOString()}>{formatOrderDate(product.updatedAt)}</time>
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </section>
  );
}
