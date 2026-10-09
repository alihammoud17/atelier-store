import "server-only";

import { asc, desc, eq, ilike, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { categories, products, productStock } from "@/db/schema";
import type { Collection, Product, ProductDetails } from "@/lib/catalog";

// Catalog reads for Server Components. This is the only storefront module that imports `@/db`.

const productColumns = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  category: categories.name,
  priceCents: products.priceCents,
  imageSrc: products.imageSrc,
  imageAlt: products.imageAlt,
  badge: products.badge,
  // A product without a stock row has none to sell.
  stock: sql<number>`coalesce(${productStock.quantity}, 0)`.mapWith(Number),
};

type ProductRow = {
  id: number;
  slug: string;
  name: string;
  category: string;
  priceCents: number;
  imageSrc: string;
  imageAlt: string;
  badge: string | null;
  stock: number;
};

function toProduct({ imageSrc, imageAlt, badge, ...row }: ProductRow): Product {
  return { ...row, image: { src: imageSrc, alt: imageAlt }, badge: badge ?? undefined };
}

function selectProducts() {
  return db
    .select(productColumns)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(productStock, eq(productStock.productId, products.id));
}

export async function getNewArrivals(limit = 8) {
  const rows = await selectProducts().orderBy(desc(products.createdAt)).limit(limit);
  return rows.map(toProduct);
}

/** Case-insensitive match on name, category and description; name matches first, then newest. */
export async function searchProducts(query: string, limit = 48) {
  // Escape LIKE wildcards so "%" or "_" in the query match literally.
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await selectProducts()
    .where(
      or(
        ilike(products.name, pattern),
        ilike(categories.name, pattern),
        ilike(products.description, pattern),
      ),
    )
    .orderBy(sql`(${products.name} ilike ${pattern}) desc`, desc(products.createdAt))
    .limit(limit);
  return rows.map(toProduct);
}

export async function getGiftEdit() {
  const rows = await selectProducts()
    .where(eq(products.isGiftEdit, true))
    .orderBy(desc(products.createdAt));
  return rows.map(toProduct);
}

/** Categories with a grid image, in grid order. */
export async function getHomeCategories(): Promise<Collection[]> {
  const rows = await db
    .select()
    .from(categories)
    .where(isNotNull(categories.imageSrc))
    .orderBy(asc(categories.position));
  return rows.map((row) => ({
    slug: row.slug,
    eyebrow: row.name,
    title: row.title,
    image: { src: row.imageSrc ?? "", alt: row.imageAlt ?? "" },
  }));
}

export async function getCategorySlugs() {
  const rows = await db.select({ slug: categories.slug }).from(categories);
  return rows.map((row) => row.slug);
}

// Wrapped in `cache` so generateMetadata and the page share one query per request.
export const getCategory = cache(async (slug: string) => {
  const [row] = await db
    .select({ id: categories.id, slug: categories.slug, name: categories.name, title: categories.title })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return row;
});

export async function getCategoryProducts(categoryId: number) {
  const rows = await selectProducts()
    .where(eq(products.categoryId, categoryId))
    .orderBy(desc(products.createdAt));
  return rows.map(toProduct);
}

export async function getProductSlugs() {
  const rows = await db.select({ slug: products.slug }).from(products);
  return rows.map((row) => row.slug);
}

export type ProductWithDetails = Product & ProductDetails & { categoryId: number };

// Wrapped in `cache` so generateMetadata and the page share one query per request.
export const getProduct = cache(async (slug: string): Promise<ProductWithDetails | undefined> => {
  const [row] = await db
    .select({
      ...productColumns,
      categoryId: products.categoryId,
      description: products.description,
      details: products.details,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(productStock, eq(productStock.productId, products.id))
    .where(eq(products.slug, slug))
    .limit(1);
  if (!row) return undefined;

  const { categoryId, description, details, ...product } = row;
  return { ...toProduct(product), categoryId, description, details };
});

/** Same-category pieces first, then the rest of the catalog, newest first. */
export async function getRelatedProducts(product: ProductWithDetails, limit = 4) {
  const rows = await selectProducts()
    .where(ne(products.id, product.id))
    .orderBy(sql`(${products.categoryId} = ${product.categoryId}) desc`, desc(products.createdAt))
    .limit(limit);
  return rows.map(toProduct);
}

/** Live price, details and stock for the products in a bag. Missing IDs are simply absent. */
export async function getBagProducts(ids: number[]) {
  if (ids.length === 0) return [];
  const rows = await selectProducts().where(inArray(products.id, ids));
  return rows.map(toProduct);
}
