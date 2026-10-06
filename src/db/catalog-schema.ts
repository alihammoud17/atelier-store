import { relations, sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  /** Short label shown on product cards and breadcrumbs, e.g. "Bags". */
  name: text("name").notNull(),
  /** Heading in the home category grid, e.g. "Handbags". */
  title: text("title").notNull(),
  /** Grid image; categories without one are left out of the home grid. */
  imageSrc: text("image_src"),
  imageAlt: text("image_alt"),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

export const products = pgTable(
  "products",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    priceCents: integer("price_cents").notNull(),
    description: text("description").notNull(),
    details: text("details").array().notNull().default(sql`'{}'::text[]`),
    imageSrc: text("image_src").notNull(),
    imageAlt: text("image_alt").notNull(),
    badge: text("badge"),
    isGiftEdit: boolean("is_gift_edit").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("products_category_id_idx").on(table.categoryId),
    index("products_created_at_idx").on(table.createdAt),
    check("products_price_cents_check", sql`${table.priceCents} >= 0`),
  ],
);

// One row per product for now; moves to variant level once variants exist.
export const productStock = pgTable(
  "product_stock",
  {
    productId: integer("product_id")
      .primaryKey()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
    updatedAt: timestamps.updatedAt,
  },
  (table) => [check("product_stock_quantity_check", sql`${table.quantity} >= 0`)],
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  stock: one(productStock),
}));

export const productStockRelations = relations(productStock, ({ one }) => ({
  product: one(products, { fields: [productStock.productId], references: [products.id] }),
}));
