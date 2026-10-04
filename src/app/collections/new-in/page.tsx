import type { Metadata } from "next";
import { ProductListing } from "@/components/product/product-listing";
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
    <ProductListing
      breadcrumb="New In"
      eyebrow="Just in"
      title="New arrivals"
      products={products}
      emptyMessage="New pieces are on their way. Check back soon."
    />
  );
}
