import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { categories, orderItems, orders, products, productStock, user } from "@/db/schema";
import type { OrderStatus } from "@/lib/checkout";

// Test data builders for integration tests. Each inserts real rows with sensible defaults
// and returns them; override only what the test is about.

let sequence = 0;
const next = () => ++sequence;

export async function createCategory(overrides: Partial<typeof categories.$inferInsert> = {}) {
  const n = next();
  const [row] = await db
    .insert(categories)
    .values({ slug: `category-${n}`, name: `Category ${n}`, title: `Category ${n} title`, ...overrides })
    .returning();
  return row;
}

type ProductInput = Partial<typeof products.$inferInsert> & {
  /** Units in `product_stock`; `null` creates no stock row at all. Default 10. */
  stock?: number | null;
};

/** A product with a `product_stock` row. Creates a category unless `categoryId` is given. */
export async function createProduct({ stock = 10, ...overrides }: ProductInput = {}) {
  const n = next();
  const categoryId = overrides.categoryId ?? (await createCategory()).id;
  const [product] = await db
    .insert(products)
    .values({
      slug: `product-${n}`,
      name: `Product ${n}`,
      priceCents: 10_000,
      description: `Description for product ${n}.`,
      imageSrc: `https://images.unsplash.com/photo-${n}`,
      imageAlt: `Product ${n}`,
      ...overrides,
      categoryId,
    })
    .returning();
  if (stock !== null) await db.insert(productStock).values({ productId: product.id, quantity: stock });
  return { ...product, stock };
}

/** A user row as Better Auth would create it, without credentials (it can't sign in). */
export async function createUser(overrides: Partial<typeof user.$inferInsert> = {}) {
  const n = next();
  const [row] = await db
    .insert(user)
    .values({ id: randomUUID(), name: `Customer ${n}`, email: `customer-${n}@example.com`, ...overrides })
    .returning();
  return row;
}

type OrderInput = Partial<Omit<typeof orders.$inferInsert, "status">> & {
  status?: OrderStatus;
  /** Order lines; prices default to the product's price. Totals are computed from them. */
  items?: { product: { id: number; name: string; priceCents: number }; quantity?: number; unitPriceCents?: number }[];
};

/**
 * An order with its items. Only inserts rows: stock isn't decremented, so create products
 * with the stock the scenario needs. A `paid` order gets `paidAt` unless one is given.
 */
export async function createOrder({ items = [], status = "pending", ...overrides }: OrderInput = {}) {
  const lines = items.map(({ product, quantity = 1, unitPriceCents = product.priceCents }) => ({
    productId: product.id,
    productName: product.name,
    unitPriceCents,
    quantity,
  }));
  const totalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);

  const [order] = await db
    .insert(orders)
    .values({
      status,
      subtotalCents: totalCents,
      totalCents,
      paidAt: status === "paid" ? new Date() : null,
      ...overrides,
    })
    .returning();
  if (lines.length > 0) {
    await db.insert(orderItems).values(lines.map((line) => ({ ...line, orderId: order.id })));
  }
  return order;
}
