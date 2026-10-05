import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToBagForm } from "@/components/bag/add-to-bag-form";
import { SectionHeading } from "@/components/home/section-heading";
import { ProductCard } from "@/components/product/product-card";
import { StockStatus } from "@/components/product/stock-status";
import { WishlistButton } from "@/components/product/wishlist-button";
import {
  CatalogImage,
  Eyebrow,
  Heading,
  MediaFrame,
  ProductGrid,
  Text,
} from "@/components/ui";
import { formatPrice } from "@/lib/catalog";
import { getProduct, getProductSlugs, getRelatedProducts } from "@/lib/products";

// Stock comes from Postgres; refresh prerendered pages at most once a minute.
export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  return { title: product.name, description: product.description };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const soldOut = product.stock <= 0;
  const related = await getRelatedProducts(product);

  return (
    <main id="main" className="flex-1">
      <div className="container-page pt-6 md:pt-8">
        <nav aria-label="Breadcrumb" className="text-2xs tracking-wide text-ink-muted uppercase">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="link-reveal">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>{product.category}</li>
          </ol>
        </nav>
      </div>

      <section className="container-page grid gap-8 py-6 md:py-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-16">
        <div className="relative">
          <MediaFrame>
            <CatalogImage
              src={product.image.src}
              alt={product.image.alt}
              fill
              priority
              sizes="(min-width: 64rem) 58vw, 100vw"
            />
            {product.badge && (
              <span className="text-label absolute top-3 left-3 bg-canvas px-2 py-1">{product.badge}</span>
            )}
          </MediaFrame>
        </div>

        <div className="lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:self-start">
          <Eyebrow className="text-ink-muted">{product.category}</Eyebrow>
          <Heading as="h1" size="3xl" className="mt-3">
            {product.name}
          </Heading>
          <Text size="md" className="mt-4">
            {formatPrice(product.priceCents)}
          </Text>

          <StockStatus stock={product.stock} className="mt-6" />

          <div className="mt-6">
            <AddToBagForm productId={product.id} soldOut={soldOut}>
              <WishlistButton productName={product.name} className="shrink-0 border border-line" />
            </AddToBagForm>
          </div>

          <Text tone="muted" className="mt-5">
            {product.description}
          </Text>

          <div className="mt-8 border-t border-line pt-6">
            <Eyebrow>Details</Eyebrow>
            <ul className="mt-4 flex flex-col gap-2 text-sm text-ink-muted">
              {product.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 border-t border-line pt-6">
            <Text size="sm" tone="muted">
              Complimentary shipping and returns within 30 days.
            </Text>
          </div>
        </div>
      </section>

      <section aria-labelledby="related-title" className="container-page section-y border-t border-line">
        <SectionHeading id="related-title" eyebrow="You may also like" title="Related pieces" />
        <ProductGrid>
          {related.map((item) => (
            <li key={item.id}>
              <ProductCard product={item} />
            </li>
          ))}
        </ProductGrid>
      </section>
    </main>
  );
}
