import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListing } from "@/components/product/product-listing";
import { getCategory, getCategoryProducts, getCategorySlugs } from "@/lib/products";

// Catalog data comes from Postgres; refresh prerendered pages at most once a minute.
export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getCategorySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return {};
  return { title: category.title, description: `${category.title}, newest first.` };
}

export default async function CategoryPage({ params }: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const products = await getCategoryProducts(category.id);

  return (
    <ProductListing
      breadcrumb={category.name}
      eyebrow="Collection"
      title={category.title}
      products={products}
      emptyMessage="New pieces are on their way. Check back soon."
    />
  );
}
