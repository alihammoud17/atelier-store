import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, productStock, stripeEvents } from "@/db/schema";

// Read-backs for assertions in integration tests.

export async function getOrder(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  return order;
}

export async function getOrders() {
  return db.select().from(orders).orderBy(asc(orders.createdAt));
}

export async function getOrderItems(orderId: string) {
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.productId));
}

/** Units in product_stock, or undefined when the product has no stock row. */
export async function getStock(productId: number) {
  const [row] = await db.select({ quantity: productStock.quantity }).from(productStock).where(eq(productStock.productId, productId));
  return row?.quantity;
}

export async function getStripeEvents() {
  return db.select().from(stripeEvents);
}
