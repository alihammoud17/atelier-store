import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product/product-card";
import { Eyebrow, Heading, ProductGrid, Text } from "@/components/ui";
import { getNewArrivals } from "@/lib/products";

// Catalog data comes from Postgres; refresh the prerendered page at most once a minute.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "New arrivals",
  description: "The latest pieces from the atelier, newest first.",
};

export default async function NewArrivalsPage() {
  const products = await getNewArrivals(24);

  return (
    <main id="main" className="flex-1">
      <div className="container-page pt-6 md:pt-8">
        <nav aria-label="Breadcrumb" className="text-2xs tracking-wide text-ink-muted uppercase">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="link-reveal">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">New In</li>
          </ol>
        </nav>
      </div>

      <section aria-labelledby="new-arrivals-title" className="container-page pt-8 pb-section md:pt-12">
        <header className="mb-8 flex items-end justify-between gap-6 border-b border-line pb-6 md:mb-10">
          <div className="flex flex-col gap-2">
            <Eyebrow className="text-ink-muted">Just in</Eyebrow>
            <Heading as="h1" id="new-arrivals-title" size="3xl">
              New arrivals
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
          <Text tone="muted">New pieces are on their way. Check back soon.</Text>
        )}
      </section>
    </main>
  );
}
