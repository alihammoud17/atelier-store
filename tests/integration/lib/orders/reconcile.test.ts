// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/lib/orders/reconcile.test.ts)
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getStaleOrders, reconcileStaleOrders } from "@/lib/orders";
import { createReservedOrder } from "@tests/helpers/checkout";
import { createOrder, createProduct } from "@tests/helpers/factories";
import { getOrder, getStock } from "@tests/helpers/queries";
import { invalidRequestError, makeCheckoutSession, stripeMock } from "@tests/helpers/stripe";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const backdate = (orderId: string, minutes: number) =>
  db.update(orders).set({ createdAt: minutesAgo(minutes) }).where(eq(orders.id, orderId));

describe("getStaleOrders", () => {
  test("lists pending and processing orders older than the cut-off, oldest first", async () => {
    const oldPending = await createOrder({ status: "pending", createdAt: minutesAgo(60) });
    const oldProcessing = await createOrder({ status: "processing", createdAt: minutesAgo(90), stripeCheckoutSessionId: "cs_test_p" });
    await createOrder({ status: "pending", createdAt: minutesAgo(10) });
    await createOrder({ status: "paid", createdAt: minutesAgo(120) });
    await createOrder({ status: "expired", createdAt: minutesAgo(120) });

    expect(await getStaleOrders(35)).toEqual([
      { id: oldProcessing.id, status: "processing", sessionId: "cs_test_p" },
      { id: oldPending.id, status: "pending", sessionId: null },
    ]);
  });
});

describe("reconcileStaleOrders", () => {
  test("releases stale orders without a session and settles the rest from Stripe", async () => {
    const tote = await createProduct({ priceCents: 48_000, stock: 3 });
    const noSession = await createReservedOrder([{ product: tote }], { sessionId: null });
    const expired = await createReservedOrder([{ product: tote }]);
    const recent = await createReservedOrder([{ product: tote }]);
    await backdate(noSession.orderId, 40);
    await backdate(expired.orderId, 50);
    stripeMock.checkout.sessions.retrieve.mockResolvedValue(
      makeCheckoutSession({ id: expired.sessionId ?? undefined, orderId: expired.orderId, status: "expired", payment_status: "unpaid" }),
    );

    const results = await reconcileStaleOrders(35);

    expect(results.map(({ orderId, outcome }) => ({ orderId, outcome }))).toEqual([
      { orderId: expired.orderId, outcome: "synced" },
      { orderId: noSession.orderId, outcome: "released" },
    ]);
    expect((await getOrder(noSession.orderId)).status).toBe("failed");
    expect((await getOrder(expired.orderId)).status).toBe("expired");
    expect((await getOrder(recent.orderId)).status).toBe("pending");
    expect(await getStock(tote.id)).toBe(2);
  });

  test("keeps going when one order fails, and reports sessions Stripe doesn't know", async () => {
    const tote = await createProduct({ stock: 5 });
    const broken = await createReservedOrder([{ product: tote }]);
    const unknown = await createReservedOrder([{ product: tote }]);
    await backdate(broken.orderId, 60);
    await backdate(unknown.orderId, 50);
    stripeMock.checkout.sessions.retrieve
      .mockRejectedValueOnce(new Error("Stripe is down"))
      .mockRejectedValueOnce(invalidRequestError());

    const results = await reconcileStaleOrders(35);

    expect(results).toEqual([
      { orderId: broken.orderId, outcome: "error", error: expect.objectContaining({ message: "Stripe is down" }) },
      { orderId: unknown.orderId, outcome: "synced", session: null },
    ]);
    expect((await getOrder(broken.orderId)).status).toBe("pending");
  });
});
