import "server-only";

import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, orderItems, orders, products, productStock } from "@/db/schema";
import {
  MAX_STOCK_QUANTITY,
  type CategoryField,
  type CategoryInput,
  type FieldErrors,
  type ProductField,
  type ProductInput,
} from "@/lib/admin-forms";

// Admin reads and writes for products, categories and stock. Callers (admin pages and server
// actions) must call requireAdmin() first; nothing here checks the session. Input is already
// validated by `@/lib/admin-forms`.

// ---------------------------------------------------------------------------------------------
// Postgres errors

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
/** Raised instead of 23503 when deleting a row an `on delete restrict` key still points to. */
const RESTRICT_VIOLATION = "23001";

/** The Postgres error behind a failed query; Drizzle wraps the driver's error in `cause`. */
function pgError(error: unknown): { code?: string; constraint?: string } | undefined {
  for (let current = error; current && typeof current === "object"; current = (current as { cause?: unknown }).cause) {
    if ("code" in current && typeof current.code === "string") return current as { code: string; constraint?: string };
  }
  return undefined;
}

function isViolation(error: unknown, code: string, constraint: string) {
  const pg = pgError(error);
  return pg?.code === code && pg.constraint === constraint;
}

// ---------------------------------------------------------------------------------------------
// Reads

const stockQuantity = sql<number>`coalesce(${productStock.quantity}, 0)`.mapWith(Number);

export async function getAdminProducts() {
  return db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      category: categories.name,
      priceCents: products.priceCents,
      imageSrc: products.imageSrc,
      stock: stockQuantity,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(productStock, eq(productStock.productId, products.id))
    .orderBy(desc(products.createdAt), desc(products.id));
}

export async function getAdminProduct(id: number) {
  const [row] = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      categoryId: products.categoryId,
      priceCents: products.priceCents,
      description: products.description,
      details: products.details,
      imageSrc: products.imageSrc,
      imageAlt: products.imageAlt,
      badge: products.badge,
      isGiftEdit: products.isGiftEdit,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return row;
}

const productCount = db
  .select({ categoryId: products.categoryId, total: count().as("total") })
  .from(products)
  .groupBy(products.categoryId)
  .as("product_count");

const categoryColumns = {
  id: categories.id,
  slug: categories.slug,
  name: categories.name,
  title: categories.title,
  imageSrc: categories.imageSrc,
  imageAlt: categories.imageAlt,
  position: categories.position,
  productCount: sql<number>`coalesce(${productCount.total}, 0)`.mapWith(Number),
};

/** All categories with how many products each holds, in home-grid order. */
export async function getAdminCategories() {
  return db
    .select(categoryColumns)
    .from(categories)
    .leftJoin(productCount, eq(productCount.categoryId, categories.id))
    .orderBy(asc(categories.position), asc(categories.name));
}

export async function getAdminCategory(id: number) {
  const [row] = await db
    .select(categoryColumns)
    .from(categories)
    .leftJoin(productCount, eq(productCount.categoryId, categories.id))
    .where(eq(categories.id, id))
    .limit(1);
  return row;
}

/**
 * Units taken off stock by orders that haven't released it, apart from paid ones (sold):
 * `reserved` by open checkouts (pending or processing), `held` by orders that need review.
 */
const held = db
  .select({
    productId: orderItems.productId,
    reserved: sql<number>`sum(${orderItems.quantity}) filter (where ${orders.status} <> 'needs_review')`.as(
      "reserved_quantity",
    ),
    held: sql<number>`sum(${orderItems.quantity}) filter (where ${orders.status} = 'needs_review')`.as("held_quantity"),
  })
  .from(orderItems)
  .innerJoin(orders, eq(orders.id, orderItems.orderId))
  .where(and(inArray(orders.status, ["pending", "processing", "needs_review"]), isNull(orders.stockReleasedAt)))
  .groupBy(orderItems.productId)
  .as("held");

/**
 * Available stock (what `product_stock` holds: reservations are already taken off), units
 * reserved by open checkouts and units held by orders that need review, per product, by name.
 * Pass a product ID for just that product.
 */
export async function getStockOverview(productId?: number) {
  return db
    .select({
      productId: products.id,
      slug: products.slug,
      name: products.name,
      category: categories.name,
      available: stockQuantity,
      reserved: sql<number>`coalesce(${held.reserved}, 0)`.mapWith(Number),
      held: sql<number>`coalesce(${held.held}, 0)`.mapWith(Number),
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(productStock, eq(productStock.productId, products.id))
    .leftJoin(held, eq(held.productId, products.id))
    .where(productId === undefined ? undefined : eq(products.id, productId))
    .orderBy(asc(products.name), asc(products.id));
}

// ---------------------------------------------------------------------------------------------
// Writes

export type WriteFailure<Field extends string> = { ok: false; message: string; fieldErrors?: FieldErrors<Field> };

export type WriteResult<Field extends string, Value = object> = ({ ok: true } & Value) | WriteFailure<Field>;

const slugTaken = { message: "Check the highlighted fields.", fieldErrors: { slug: "This slug is already used." } };

function productWriteError(error: unknown): WriteFailure<ProductField> {
  if (isViolation(error, UNIQUE_VIOLATION, "products_slug_unique")) return { ok: false, ...slugTaken };
  if (isViolation(error, FOREIGN_KEY_VIOLATION, "products_category_id_categories_id_fk")) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { categoryId: "That category no longer exists." },
    };
  }
  throw error;
}

/** Inserts a product and its stock row together. */
export async function createProduct({
  stock = 0,
  ...input
}: ProductInput & { stock?: number }): Promise<WriteResult<ProductField, { id: number; slug: string }>> {
  try {
    return await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values(input)
        .returning({ id: products.id, slug: products.slug });
      await tx.insert(productStock).values({ productId: product.id, quantity: stock });
      return { ok: true as const, ...product };
    });
  } catch (error) {
    return productWriteError(error);
  }
}

export async function updateProduct(
  id: number,
  input: ProductInput,
): Promise<WriteResult<ProductField, { slug: string }>> {
  try {
    const [product] = await db
      .update(products)
      .set(input)
      .where(eq(products.id, id))
      .returning({ slug: products.slug });
    if (!product) return { ok: false, message: "This product no longer exists." };
    return { ok: true, slug: product.slug };
  } catch (error) {
    return productWriteError(error);
  }
}

function categoryWriteError(error: unknown): WriteFailure<CategoryField> {
  if (isViolation(error, UNIQUE_VIOLATION, "categories_slug_unique")) return { ok: false, ...slugTaken };
  throw error;
}

export async function createCategory(input: CategoryInput): Promise<WriteResult<CategoryField, { id: number }>> {
  try {
    const [category] = await db.insert(categories).values(input).returning({ id: categories.id });
    return { ok: true, id: category.id };
  } catch (error) {
    return categoryWriteError(error);
  }
}

export async function updateCategory(id: number, input: CategoryInput): Promise<WriteResult<CategoryField>> {
  try {
    const updated = await db
      .update(categories)
      .set(input)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
    if (updated.length === 0) return { ok: false, message: "This category no longer exists." };
    return { ok: true };
  } catch (error) {
    return categoryWriteError(error);
  }
}

/** Deletes an empty category. The foreign key (`on delete restrict`) refuses one with products. */
export async function deleteCategory(id: number): Promise<WriteResult<never>> {
  try {
    const deleted = await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
    if (deleted.length === 0) return { ok: false, message: "This category no longer exists." };
    return { ok: true };
  } catch (error) {
    if (
      isViolation(error, RESTRICT_VIOLATION, "products_category_id_categories_id_fk") ||
      isViolation(error, FOREIGN_KEY_VIOLATION, "products_category_id_categories_id_fk")
    ) {
      return { ok: false, message: "Move or remove this category's products before deleting it." };
    }
    throw error;
  }
}

export type SetStockResult =
  | { ok: true; quantity: number }
  | { ok: false; reason: "not_found" }
  /** Stock moved (a checkout, a release or another admin) since the form was loaded. */
  | { ok: false; reason: "conflict"; current: number };

/**
 * Sets a product's available stock, but only if it still holds `expected`, so a checkout that
 * reserved stock while the form was open isn't overwritten.
 */
export async function setStock(
  productId: number,
  { quantity, expected }: { quantity: number; expected: number },
): Promise<SetStockResult> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(productStock)
      .set({ quantity })
      .where(and(eq(productStock.productId, productId), eq(productStock.quantity, expected)))
      .returning({ quantity: productStock.quantity });
    if (updated.length > 0) return { ok: true, quantity };

    const [current] = await tx
      .select({ productId: products.id, quantity: productStock.quantity })
      .from(products)
      .leftJoin(productStock, eq(productStock.productId, products.id))
      .where(eq(products.id, productId));
    if (!current) return { ok: false, reason: "not_found" };
    if (current.quantity !== null) return { ok: false, reason: "conflict", current: current.quantity };

    // No stock row yet: the storefront reads that as 0.
    if (expected !== 0) return { ok: false, reason: "conflict", current: 0 };
    const inserted = await tx
      .insert(productStock)
      .values({ productId, quantity })
      .onConflictDoNothing()
      .returning({ quantity: productStock.quantity });
    return inserted.length > 0 ? { ok: true, quantity } : { ok: false, reason: "conflict", current: 0 };
  });
}

export type AdjustStockResult =
  | { ok: true; quantity: number }
  | { ok: false; reason: "not_found" }
  /** The change would take stock below 0 or above MAX_STOCK_QUANTITY; nothing was written. */
  | { ok: false; reason: "out_of_range"; current: number };

/**
 * Adds `delta` units to a product's available stock (negative removes them). It's relative, so
 * it applies on top of whatever checkouts reserved or released in the meantime and needs no
 * expected value. The range check is part of the update, so it's against the stock at that
 * moment: the row lock makes a concurrent checkout or adjustment wait, then re-check.
 */
export async function adjustStock(productId: number, delta: number): Promise<AdjustStockResult> {
  return db.transaction(async (tx) => {
    const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.id, productId));
    if (!product) return { ok: false, reason: "not_found" };

    // No stock row yet: the storefront reads that as 0, so start from 0.
    await tx.insert(productStock).values({ productId, quantity: 0 }).onConflictDoNothing();
    const [updated] = await tx
      .update(productStock)
      .set({ quantity: sql`${productStock.quantity} + ${delta}` })
      .where(
        and(
          eq(productStock.productId, productId),
          sql`${productStock.quantity} + ${delta} between 0 and ${MAX_STOCK_QUANTITY}`,
        ),
      )
      .returning({ quantity: productStock.quantity });
    if (updated) return { ok: true, quantity: updated.quantity };

    const [current] = await tx
      .select({ quantity: productStock.quantity })
      .from(productStock)
      .where(eq(productStock.productId, productId));
    return { ok: false, reason: "out_of_range", current: current.quantity };
  });
}
