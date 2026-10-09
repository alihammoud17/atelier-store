import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdjustStockForm } from "@/components/admin/adjust-stock-form";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProductForm } from "@/components/admin/product-form";
import { StockForm } from "@/components/admin/stock-form";
import { ButtonLink, CatalogImage, Heading, MediaFrame, Text } from "@/components/ui";
import { getAdminCategories, getAdminProduct, getStockOverview } from "@/lib/admin-catalog";
import { toPositiveInt } from "@/lib/form-values";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Edit product · Admin",
};

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[productId]">) {
  await requireAdmin();
  const productId = toPositiveInt((await params).productId);
  if (!productId) notFound();

  const [product, categories, [stock]] = await Promise.all([
    getAdminProduct(productId),
    getAdminCategories(),
    getStockOverview(productId),
  ]);
  if (!product || !stock) notFound();
  const justCreated = (await searchParams).saved === "created";

  return (
    <section aria-labelledby="product-title" className="container-content py-section">
      <AdminPageHeader
        eyebrow={
          <Link href="/admin/products" className="link-reveal">
            Products
          </Link>
        }
        title={product.name}
        titleId="product-title"
        actions={
          <ButtonLink href={`/products/${product.slug}`} variant="secondary" size="sm" target="_blank">
            View in store
          </ButtonLink>
        }
      />

      {justCreated && (
        <p role="status" className="mb-8 border border-line bg-surface px-4 py-3 text-sm">
          Product created. It&rsquo;s live in the store.
        </p>
      )}

      <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-16">
        <ProductForm categories={categories} product={product} />

        <aside aria-labelledby="product-stock-title" className="flex flex-col gap-6 self-start bg-surface p-6">
          <MediaFrame className="aspect-product w-32">
            <CatalogImage src={product.imageSrc} alt={product.imageAlt} fill sizes="8rem" />
          </MediaFrame>
          <Heading as="h2" id="product-stock-title" size="lg">
            Stock
          </Heading>
          <div className="flex flex-col gap-2">
            <p className="text-label text-ink-muted">Available</p>
            <StockForm productId={product.id} productName={product.name} available={stock.available} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-label text-ink-muted">Add or remove</p>
            <AdjustStockForm productId={product.id} productName={product.name} />
          </div>
          <Text size="sm" tone="muted">
            {stock.reserved > 0
              ? `${stock.reserved} more ${stock.reserved === 1 ? "is" : "are"} held by open checkouts and return to stock if they aren't paid.`
              : "None held by open checkouts."}
          </Text>
          {stock.held > 0 && (
            <Text size="sm" tone="muted">
              {`${stock.held} ${stock.held === 1 ? "is" : "are"} held by orders that need review and stay off stock until they're resolved.`}
            </Text>
          )}
        </aside>
      </div>
    </section>
  );
}
