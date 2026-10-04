import type { Metadata } from "next";
import Form from "next/form";
import { SectionHeading } from "@/components/home/section-heading";
import { ProductCard } from "@/components/product/product-card";
import { Button, Heading, ProductGrid, Text } from "@/components/ui";
import { SearchIcon } from "@/components/ui/icons";
import { getNewArrivals, searchProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the Atelier catalog.",
};

const maxQueryLength = 100;

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim().slice(0, maxQueryLength);

  const results = query ? await searchProducts(query) : [];
  // Suggest the newest pieces before a search, or when nothing matches.
  const suggestions = results.length === 0 ? await getNewArrivals(4) : [];

  return (
    <main id="main" className="flex-1">
      <section aria-labelledby="search-title" className="container-page pt-8 pb-section md:pt-12">
        <div className="mb-8 border-b border-line pb-8 md:mb-10">
          <Heading as="h1" id="search-title" size="3xl" className="break-words">
            {query ? <>Results for &ldquo;{query}&rdquo;</> : "Search"}
          </Heading>

          <Form action="/search" role="search" className="mt-6 flex max-w-2xl gap-2">
            <label htmlFor="search-query" className="sr-only">
              Search products
            </label>
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-md text-ink-muted" />
              <input
                id="search-query"
                type="search"
                name="q"
                defaultValue={query}
                maxLength={maxQueryLength}
                autoComplete="off"
                autoFocus={!query}
                placeholder="Search products"
                className="h-12 w-full border border-line bg-canvas pr-4 pl-11 outline-none focus:border-line-strong"
              />
            </div>
            <Button type="submit" className="shrink-0">
              Search
            </Button>
          </Form>

          {results.length > 0 && (
            <Text size="sm" tone="muted" role="status" className="mt-4">
              {results.length} {results.length === 1 ? "piece" : "pieces"} found
            </Text>
          )}
        </div>

        {results.length > 0 ? (
          <ProductGrid>
            {results.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ProductGrid>
        ) : (
          <>
            {query && (
              <Text tone="muted" role="status" className="mb-section">
                Nothing matched your search. Try a different word, or browse our latest pieces.
              </Text>
            )}
            <SectionHeading
              id="suggestions-title"
              eyebrow="Just in"
              title="New arrivals"
              action={{ label: "View all", href: "/collections/new-in" }}
            />
            <ProductGrid aria-labelledby="suggestions-title">
              {suggestions.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ProductGrid>
          </>
        )}
      </section>
    </main>
  );
}
