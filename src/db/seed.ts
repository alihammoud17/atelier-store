// Seeds the starter catalog. Safe to rerun: rows are upserted by slug.
// Usage: pnpm db:seed
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { categories, products, productStock } from "./schema";
import { seedCategories, seedProducts } from "./seed-data";

// Fixed timestamps keep "New arrivals" ordering stable across reseeds.
const newestAt = new Date("2026-09-01T00:00:00Z").getTime();
const hour = 60 * 60 * 1000;

async function main() {
  await db.transaction(async (tx) => {
    const categoryRows = await tx
      .insert(categories)
      .values(
        seedCategories.map((category) => ({
          slug: category.slug,
          name: category.name,
          title: category.title,
          imageSrc: category.image?.src ?? null,
          imageAlt: category.image?.alt ?? null,
          position: category.position,
        })),
      )
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          name: sql`excluded.name`,
          title: sql`excluded.title`,
          imageSrc: sql`excluded.image_src`,
          imageAlt: sql`excluded.image_alt`,
          position: sql`excluded.position`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: categories.id, slug: categories.slug });

    const categoryIds = new Map(categoryRows.map((row) => [row.slug, row.id]));

    const productRows = await tx
      .insert(products)
      .values(
        seedProducts.map((product, index) => {
          const categoryId = categoryIds.get(product.categorySlug);
          if (!categoryId) throw new Error(`Unknown category "${product.categorySlug}" for ${product.slug}`);
          return {
            slug: product.slug,
            name: product.name,
            categoryId,
            priceCents: product.priceCents,
            description: product.description,
            details: product.details,
            imageSrc: product.image.src,
            imageAlt: product.image.alt,
            badge: product.badge ?? null,
            isGiftEdit: product.isGiftEdit ?? false,
            createdAt: new Date(newestAt - index * hour),
          };
        }),
      )
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          name: sql`excluded.name`,
          categoryId: sql`excluded.category_id`,
          priceCents: sql`excluded.price_cents`,
          description: sql`excluded.description`,
          details: sql`excluded.details`,
          imageSrc: sql`excluded.image_src`,
          imageAlt: sql`excluded.image_alt`,
          badge: sql`excluded.badge`,
          isGiftEdit: sql`excluded.is_gift_edit`,
          createdAt: sql`excluded.created_at`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: products.id, slug: products.slug });

    const stockBySlug = new Map(seedProducts.map((product) => [product.slug, product.stock]));

    await tx
      .insert(productStock)
      .values(productRows.map((row) => ({ productId: row.id, quantity: stockBySlug.get(row.slug) ?? 0 })))
      .onConflictDoUpdate({
        target: productStock.productId,
        set: { quantity: sql`excluded.quantity`, updatedAt: sql`now()` },
      });

    console.log(`Seeded ${categoryRows.length} categories, ${productRows.length} products and their stock.`);
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
