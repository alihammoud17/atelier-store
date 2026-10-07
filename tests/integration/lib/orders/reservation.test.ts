// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/lib/orders/reservation.test.ts)
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { db } from "@/db";
import { products } from "@/db/schema";
import { failOrder, releaseOrder, reserveOrder } from "@/lib/orders";
import { createReservedOrder } from "@tests/helpers/checkout";
import { createOrder, createProduct, createUser } from "@tests/helpers/factories";
import { getOrder, getOrderItems, getOrders, getStock } from "@tests/helpers/queries";

const bagOf = (...lines: [{ id: number }, number][]) =>
  lines.map(([product, quantity]) => ({ productId: product.id, quantity }));

describe("reserveOrder", () => {
  test("decrements stock and records a pending order with database prices", async () => {
    const coat = await createProduct({ name: "Coat", priceCents: 189_000, stock: 5 });
    const tote = await createProduct({ name: "Tote", priceCents: 48_000, stock: 3 });
    const customer = await createUser();

    const reservation = await reserveOrder({
      bag: bagOf([tote, 1], [coat, 2]),
      userId: customer.id,
      email: customer.email,
    });

    expect(reservation).toMatchObject({ ok: true, totalCents: 426_000 });
    if (!reservation.ok) return;
    expect(reservation.lines.map((line) => [line.productId, line.quantity, line.unitPriceCents])).toEqual([
      [tote.id, 1, 48_000],
      [coat.id, 2, 189_000],
    ]);
    expect(await getStock(coat.id)).toBe(3);
    expect(await getStock(tote.id)).toBe(2);

    expect(await getOrder(reservation.orderId)).toMatchObject({
      status: "pending",
      userId: customer.id,
      email: customer.email,
      currency: "usd",
      subtotalCents: 426_000,
      totalCents: 426_000,
      stripeCheckoutSessionId: null,
      paidAt: null,
      stockReleasedAt: null,
    });
    expect(
      (await getOrderItems(reservation.orderId)).map(({ productId, productName, unitPriceCents, quantity }) => ({
        productId,
        productName,
        unitPriceCents,
        quantity,
      })),
    ).toEqual([
      { productId: coat.id, productName: "Coat", unitPriceCents: 189_000, quantity: 2 },
      { productId: tote.id, productName: "Tote", unitPriceCents: 48_000, quantity: 1 },
    ]);
  });

  test("keeps the price snapshot when the catalog price changes later", async () => {
    const tote = await createProduct({ name: "Tote", priceCents: 48_000 });
    const reservation = await reserveOrder({ bag: bagOf([tote, 1]), userId: null, email: null });
    if (!reservation.ok) throw new Error("expected a reservation");

    await db.update(products).set({ priceCents: 99_000, name: "Renamed" }).where(eq(products.id, tote.id));
    expect(await getOrderItems(reservation.orderId)).toMatchObject([{ productName: "Tote", unitPriceCents: 48_000 }]);
    expect((await getOrder(reservation.orderId)).totalCents).toBe(48_000);
  });

  test("clamps to stock and drops sold-out and unknown products", async () => {
    const scarf = await createProduct({ priceCents: 10_000, stock: 2 });
    const soldOut = await createProduct({ stock: 0 });

    const reservation = await reserveOrder({ bag: bagOf([scarf, 5], [soldOut, 1], [{ id: 9_999 }, 1]), userId: null, email: null });

    expect(reservation).toMatchObject({ ok: true, totalCents: 20_000 });
    if (!reservation.ok) return;
    expect(reservation.lines.map((line) => [line.productId, line.quantity])).toEqual([[scarf.id, 2]]);
    expect(await getStock(scarf.id)).toBe(0);
    expect(await getStock(soldOut.id)).toBe(0);
  });

  test("an empty bag, or one that is entirely sold out, reserves nothing", async () => {
    const soldOut = await createProduct({ stock: 0 });

    expect(await reserveOrder({ bag: [], userId: null, email: null })).toEqual({ ok: false, reason: "empty" });
    expect(await reserveOrder({ bag: bagOf([soldOut, 1]), userId: null, email: null })).toEqual({ ok: false, reason: "empty" });
    expect(await getOrders()).toEqual([]);
  });

  test("refuses totals below Stripe's minimum charge without touching stock", async () => {
    const sticker = await createProduct({ priceCents: 49, stock: 5 });

    expect(await reserveOrder({ bag: bagOf([sticker, 1]), userId: null, email: null })).toEqual({
      ok: false,
      reason: "below_minimum",
    });
    expect(await getStock(sticker.id)).toBe(5);
    expect(await getOrders()).toEqual([]);

    expect(await reserveOrder({ bag: bagOf([sticker, 2]), userId: null, email: null })).toMatchObject({ ok: true, totalCents: 98 });
  });

  test("rolls everything back when the order can't be stored", async () => {
    // 2 × $20M overflows the integer total column, so the insert fails after stock was decremented.
    const vault = await createProduct({ priceCents: 2_000_000_000, stock: 5 });

    await expect(reserveOrder({ bag: bagOf([vault, 2]), userId: null, email: null })).rejects.toThrow();
    expect(await getStock(vault.id)).toBe(5);
    expect(await getOrders()).toEqual([]);
  });

  test("two shoppers racing for the last piece: exactly one gets it", async () => {
    const lastOne = await createProduct({ stock: 1 });

    const results = await Promise.all([
      reserveOrder({ bag: bagOf([lastOne, 1]), userId: null, email: null }),
      reserveOrder({ bag: bagOf([lastOne, 1]), userId: null, email: null }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, reason: "empty" }]);
    expect(await getStock(lastOne.id)).toBe(0);
    expect(await getOrders()).toHaveLength(1);
  });

  test("bags listing the same products in opposite orders don't deadlock or oversell", async () => {
    const a = await createProduct({ stock: 1 });
    const b = await createProduct({ stock: 1 });

    const results = await Promise.all([
      reserveOrder({ bag: bagOf([a, 1], [b, 1]), userId: null, email: null }),
      reserveOrder({ bag: bagOf([b, 1], [a, 1]), userId: null, email: null }),
      reserveOrder({ bag: bagOf([a, 1], [b, 1]), userId: null, email: null }),
    ]);

    const reserved = results.flatMap((result) => (result.ok ? result.lines : []));
    expect(reserved.filter((line) => line.productId === a.id)).toHaveLength(1);
    expect(reserved.filter((line) => line.productId === b.id)).toHaveLength(1);
    expect(await getStock(a.id)).toBe(0);
    expect(await getStock(b.id)).toBe(0);
  });
});

describe("releaseOrder", () => {
  test("returns reserved stock once and records why", async () => {
    const coat = await createProduct({ stock: 5 });
    const tote = await createProduct({ stock: 5 });
    const { orderId } = await createReservedOrder([{ product: coat, quantity: 2 }, { product: tote }]);
    expect(await getStock(coat.id)).toBe(3);

    expect(await db.transaction((tx) => releaseOrder(tx, orderId, "expired"))).toBe(true);
    expect(await getStock(coat.id)).toBe(5);
    expect(await getStock(tote.id)).toBe(5);
    const order = await getOrder(orderId);
    expect(order.status).toBe("expired");
    expect(order.stockReleasedAt).toBeInstanceOf(Date);

    expect(await db.transaction((tx) => releaseOrder(tx, orderId, "failed"))).toBe(false);
    expect(await getStock(coat.id)).toBe(5);
    expect((await getOrder(orderId)).status).toBe("expired");
  });

  test("releases processing orders too", async () => {
    const coat = await createProduct({ stock: 2 });
    const order = await createOrder({ status: "processing", items: [{ product: coat, quantity: 1 }] });

    expect(await db.transaction((tx) => releaseOrder(tx, order.id, "failed"))).toBe(true);
    expect(await getStock(coat.id)).toBe(3);
  });

  test.each(["paid", "expired", "failed", "needs_review"] as const)("leaves a %s order and its stock alone", async (status) => {
    const coat = await createProduct({ stock: 2 });
    const order = await createOrder({ status, items: [{ product: coat, quantity: 1 }] });

    expect(await db.transaction((tx) => releaseOrder(tx, order.id, "expired"))).toBe(false);
    expect(await getStock(coat.id)).toBe(2);
    expect((await getOrder(order.id)).status).toBe(status);
  });

  test("skips items whose product was deleted", async () => {
    const coat = await createProduct({ stock: 5 });
    const gone = await createProduct({ stock: 5 });
    const { orderId } = await createReservedOrder([{ product: coat }, { product: gone }]);
    await db.delete(products).where(eq(products.id, gone.id));

    expect(await db.transaction((tx) => releaseOrder(tx, orderId, "expired"))).toBe(true);
    expect(await getStock(coat.id)).toBe(5);
    expect(await getOrderItems(orderId)).toHaveLength(2);
  });

  test("failOrder releases a pending order as failed", async () => {
    const coat = await createProduct({ stock: 1 });
    const { orderId } = await createReservedOrder([{ product: coat }], { sessionId: null });

    await failOrder(orderId);
    expect((await getOrder(orderId)).status).toBe("failed");
    expect(await getStock(coat.id)).toBe(1);
  });
});
