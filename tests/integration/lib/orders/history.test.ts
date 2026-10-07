// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/lib/orders/history.test.ts)
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { db } from "@/db";
import { products } from "@/db/schema";
import type { OrderStatus } from "@/lib/checkout";
import { getCustomerOrder, getCustomerOrders } from "@/lib/orders";
import { createOrder, createProduct, createUser } from "@tests/helpers/factories";

const day = (n: number) => new Date(Date.UTC(2026, 8, n));

/** One order per status for `userId`, a day apart, plus an unplaced failure. */
async function ordersFor(userId: string) {
  const tote = await createProduct({ name: "Tote", priceCents: 48_000 });
  const make = (n: number, status: OrderStatus, extra = {}) =>
    createOrder({ userId, status, createdAt: day(n), items: [{ product: tote, quantity: n }], ...extra });
  return {
    tote,
    paid: await make(1, "paid"),
    processing: await make(2, "processing", { stripePaymentIntentId: `pi_test_processing_${userId}` }),
    review: await make(3, "needs_review"),
    asyncFailed: await make(4, "failed", { stripePaymentIntentId: `pi_test_failed_${userId}` }),
    neverReachedStripe: await make(5, "failed"),
    pending: await make(6, "pending"),
    expired: await make(7, "expired"),
  };
}

describe("getCustomerOrders", () => {
  test("lists only the customer's placed orders, newest first", async () => {
    const customer = await createUser();
    const other = await createUser();
    const mine = await ordersFor(customer.id);
    await ordersFor(other.id);
    await createOrder({ userId: null, status: "paid" });

    const orders = await getCustomerOrders(customer.id);

    expect(orders.map((order) => order.id)).toEqual([mine.asyncFailed.id, mine.review.id, mine.processing.id, mine.paid.id]);
    expect(orders[0]).toEqual({
      id: mine.asyncFailed.id,
      status: "failed",
      totalCents: 4 * 48_000,
      createdAt: day(4),
      items: [{ quantity: 4 }],
    });
  });

  test("respects the limit", async () => {
    const customer = await createUser();
    const mine = await ordersFor(customer.id);
    expect((await getCustomerOrders(customer.id, 2)).map((order) => order.id)).toEqual([mine.asyncFailed.id, mine.review.id]);
  });

  test("is empty for a customer without placed orders", async () => {
    const customer = await createUser();
    await createOrder({ userId: customer.id, status: "pending" });
    expect(await getCustomerOrders(customer.id)).toEqual([]);
  });
});

describe("getCustomerOrder", () => {
  test("returns the customer's order with items and product links", async () => {
    const customer = await createUser();
    const coat = await createProduct({ slug: "wool-coat", name: "Wool Coat", priceCents: 189_000 });
    const order = await createOrder({
      userId: customer.id,
      status: "paid",
      email: "member@example.com",
      items: [{ product: coat, quantity: 2 }],
    });

    expect(await getCustomerOrder(customer.id, order.id)).toMatchObject({
      id: order.id,
      status: "paid",
      email: "member@example.com",
      subtotalCents: 378_000,
      totalCents: 378_000,
      items: [
        {
          productName: "Wool Coat",
          unitPriceCents: 189_000,
          quantity: 2,
          product: { slug: "wool-coat", imageSrc: coat.imageSrc, imageAlt: coat.imageAlt },
        },
      ],
    });
  });

  test("keeps the snapshot of a product deleted since the order", async () => {
    const customer = await createUser();
    const gone = await createProduct({ name: "Retired Scarf", priceCents: 12_000 });
    const order = await createOrder({ userId: customer.id, status: "paid", items: [{ product: gone }] });
    await db.delete(products).where(eq(products.id, gone.id));

    expect((await getCustomerOrder(customer.id, order.id))?.items).toEqual([
      { id: expect.any(Number), productName: "Retired Scarf", unitPriceCents: 12_000, quantity: 1, product: null },
    ]);
  });

  test("never returns another customer's order", async () => {
    const owner = await createUser();
    const snoop = await createUser();
    const order = await createOrder({ userId: owner.id, status: "paid" });
    const guestOrder = await createOrder({ userId: null, status: "paid" });

    expect(await getCustomerOrder(snoop.id, order.id)).toBeUndefined();
    expect(await getCustomerOrder(snoop.id, guestOrder.id)).toBeUndefined();
  });

  test("hides checkouts that never became orders", async () => {
    const customer = await createUser();
    const mine = await ordersFor(customer.id);

    for (const order of [mine.pending, mine.expired, mine.neverReachedStripe]) {
      expect(await getCustomerOrder(customer.id, order.id)).toBeUndefined();
    }
    for (const order of [mine.paid, mine.processing, mine.review, mine.asyncFailed]) {
      expect((await getCustomerOrder(customer.id, order.id))?.id).toBe(order.id);
    }
  });

  test("returns undefined for malformed IDs without querying", async () => {
    const customer = await createUser();
    expect(await getCustomerOrder(customer.id, "not-a-uuid")).toBeUndefined();
    expect(await getCustomerOrder(customer.id, "' or 1=1 --")).toBeUndefined();
  });
});
