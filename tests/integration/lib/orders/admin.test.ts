// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/lib/orders/admin.test.ts)
import { describe, expect, test } from "vitest";
import type { OrderStatus } from "@/lib/checkout";
import { getAdminOrder, getAdminOrders } from "@/lib/orders";
import { createOrder, createProduct, createUser } from "@tests/helpers/factories";

const day = (n: number) => new Date(Date.UTC(2026, 8, n));

async function orders() {
  const alice = await createUser({ name: "Alice" });
  const bob = await createUser({ name: "Bob" });
  const tote = await createProduct({ name: "Tote", priceCents: 48_000 });
  const make = (n: number, status: OrderStatus, extra = {}) =>
    createOrder({ status, createdAt: day(n), items: [{ product: tote, quantity: n }], ...extra });
  return {
    alice,
    paid: await make(1, "paid", { userId: alice.id }),
    guest: await make(2, "paid", { userId: null, email: "guest@example.com" }),
    processing: await make(3, "processing", { userId: bob.id, stripePaymentIntentId: "pi_test_processing" }),
    review: await make(4, "needs_review", { userId: bob.id }),
    asyncFailed: await make(5, "failed", { userId: alice.id, stripePaymentIntentId: "pi_test_failed" }),
    neverReachedStripe: await make(6, "failed", { userId: alice.id }),
    pending: await make(7, "pending", { userId: alice.id }),
    expired: await make(8, "expired", { userId: bob.id }),
  };
}

describe("getAdminOrders", () => {
  test("lists placed orders from every customer and guests, newest first", async () => {
    const o = await orders();
    const list = await getAdminOrders();

    expect(list.map((order) => order.id)).toEqual([o.asyncFailed.id, o.review.id, o.processing.id, o.guest.id, o.paid.id]);
    expect(list.at(-1)).toEqual({
      id: o.paid.id,
      status: "paid",
      email: null,
      totalCents: 48_000,
      createdAt: day(1),
      user: { name: "Alice", email: o.alice.email },
      items: [{ quantity: 1 }],
    });
    expect(list.find((order) => order.id === o.guest.id)).toMatchObject({ user: null, email: "guest@example.com" });
  });

  test("filters by status, still only among placed orders", async () => {
    const o = await orders();
    expect((await getAdminOrders({ status: "paid" })).map((order) => order.id)).toEqual([o.guest.id, o.paid.id]);
    expect((await getAdminOrders({ status: "failed" })).map((order) => order.id)).toEqual([o.asyncFailed.id]);
    expect(await getAdminOrders({ status: "pending" })).toEqual([]);
    expect(await getAdminOrders({ status: "expired" })).toEqual([]);
  });

  test("respects the limit", async () => {
    await orders();
    expect(await getAdminOrders({ limit: 2 })).toHaveLength(2);
  });
});

describe("getAdminOrder", () => {
  test("returns any customer's placed order with its lines and payment references", async () => {
    const o = await orders();
    const order = await getAdminOrder(o.processing.id);

    expect(order).toMatchObject({
      id: o.processing.id,
      status: "processing",
      stripePaymentIntentId: "pi_test_processing",
      user: { name: "Bob" },
      items: [{ productName: "Tote", unitPriceCents: 48_000, quantity: 3, product: { slug: expect.any(String) } }],
    });
  });

  test("is undefined for open, abandoned, unknown and malformed IDs", async () => {
    const o = await orders();
    for (const id of [o.pending.id, o.expired.id, o.neverReachedStripe.id, "3f1c2b9e-8f44-4d7a-9a8e-1b2c3d4e5f60", "not-a-uuid", "", "' or 1=1 --"]) {
      expect(await getAdminOrder(id)).toBeUndefined();
    }
  });
});
