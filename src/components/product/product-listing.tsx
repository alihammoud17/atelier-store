import Link from "next/link";
import { Eyebrow, Heading, ProductGrid, Text } from "@/components/ui";
import type { Product } from "@/lib/catalog";
import { ProductCard } from "./product-card";

type ProductListingProps = {
  /** Last breadcrumb item, e.g. "New In" or the category name. */
  breadcrumb: string;
  eyebrow: string;
  title: string;
  products: Product[];
  emptyMessage: string;
};

/** Full-page product listing: breadcrumb, page title with a piece count, and the product grid. */
export function ProductListing({ breadcrumb, eyebrow, title, products, emptyMessage }: ProductListingProps) {
  return (
    <main id="main" className="flex-1">
      <div className="container-page pt-6 md:pt-8">
        <nav aria-label="Breadcrumb" className="text-2xs tracking-wide text-ink-muted uppercase">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="link-reveal">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{breadcrumb}</li>
          </ol>
        </nav>
      </div>

      <section aria-labelledby="listing-title" className="container-page pt-8 pb-section md:pt-12">
        <header className="mb-8 flex items-end justify-between gap-6 border-b border-line pb-6 md:mb-10">
          <div className="flex flex-col gap-2">
            <Eyebrow className="text-ink-muted">{eyebrow}</Eyebrow>
            <Heading as="h1" id="listing-title" size="3xl">
              {title}
            </Heading>
          </div>
          <Text size="sm" tone="muted" className="shrink-0">
            {products.length} {products.length === 1 ? "piece" : "pieces"}
          </Text>
        </header>

        {products.length > 0 ? (
          <ProductGrid>
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ProductGrid>
        ) : (
          <Text tone="muted">{emptyMessage}</Text>
        )}
      </section>
    </main>
  );
}
