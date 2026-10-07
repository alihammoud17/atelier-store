// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/lib/orders/apply-session.test.ts)
import type Stripe from "stripe";
import { afterEach, describe, expect, test, vi } from "vitest";
import { db } from "@/db";
import type { CheckoutEventType } from "@/lib/checkout";
import { applyCheckoutSession, processStripeEvent } from "@/lib/orders";
import { createReservedOrder } from "@tests/helpers/checkout";
import { createProduct } from "@tests/helpers/factories";
import { getOrder, getStock, getStripeEvents } from "@tests/helpers/queries";
import { makeCheckoutSession, makeEvent } from "@tests/helpers/stripe";

afterEach(() => {
  vi.restoreAllMocks();
});

/** A reserved $480 order (one tote) with its Checkout Session, and the product. */
async function setup({ email = null as string | null } = {}) {
  const tote = await createProduct({ priceCents: 48_000, stock: 3 });
  const order = await createReservedOrder([{ product: tote }], { email });
  const session = (overrides: Partial<Stripe.Checkout.Session> = {}) =>
    makeCheckoutSession({ id: order.sessionId ?? undefined, orderId: order.orderId, amount_total: 48_000, ...overrides });
  return { tote, order, session };
}

const apply = (session: Stripe.Checkout.Session, eventType?: CheckoutEventType) =>
  db.transaction((tx) => applyCheckoutSession(tx, session, eventType));

const shipping = {
  shipping_details: {
    name: "Ada Lovelace",
    address: { line1: "1 Main St", line2: null, city: "Brooklyn", state: "NY", postal_code: "11201", country: "US" },
  },
} as Stripe.Checkout.Session["collected_information"];

describe("applyCheckoutSession", () => {
  test("a paid session marks the order paid with payment, email and shipping details", async () => {
    const { order, session, tote } = await setup({ email: "account@example.com" });

    const result = await apply(
      session({ payment_intent: "pi_test_123", customer_details: { email: "stripe@example.com" } as Stripe.Checkout.Session.CustomerDetails, collected_information: shipping }),
      "checkout.session.completed",
    );

    expect(result).toBe("paid");
    const stored = await getOrder(order.orderId);
    expect(stored).toMatchObject({
      status: "paid",
      stripePaymentIntentId: "pi_test_123",
      email: "stripe@example.com",
      shippingDetails: {
        name: "Ada Lovelace",
        address: { line1: "1 Main St", line2: null, city: "Brooklyn", state: "NY", postalCode: "11201", country: "US" },
      },
      stockReleasedAt: null,
    });
    expect(stored.paidAt).toBeInstanceOf(Date);
    expect(await getStock(tote.id)).toBe(2); // the reservation becomes the sale
  });

  test("keeps the order's email when Stripe has none", async () => {
    const { order, session } = await setup({ email: "account@example.com" });
    await apply(session({ customer_details: null }));
    expect((await getOrder(order.orderId)).email).toBe("account@example.com");
  });

  test("finds the order through client_reference_id when metadata is missing", async () => {
    const { order, session } = await setup();
    expect(await apply(session({ metadata: {} }))).toBe("paid");
    expect((await getOrder(order.orderId)).status).toBe("paid");
  });

  test("an unpaid completed session (async payment) moves the order to processing", async () => {
    const { order, session, tote } = await setup();

    expect(await apply(session({ payment_status: "unpaid", payment_intent: "pi_test_async" }), "checkout.session.completed")).toBe("processing");
    expect(await getOrder(order.orderId)).toMatchObject({ status: "processing", stripePaymentIntentId: "pi_test_async", paidAt: null });
    expect(await getStock(tote.id)).toBe(2);

    expect(await apply(session(), "checkout.session.async_payment_succeeded")).toBe("paid");
    expect((await getOrder(order.orderId)).status).toBe("paid");
  });

  test("an async payment failure releases the stock", async () => {
    const { order, session, tote } = await setup();
    await apply(session({ payment_status: "unpaid" }), "checkout.session.completed");

    expect(await apply(session({ payment_status: "unpaid" }), "checkout.session.async_payment_failed")).toBe("release");
    expect((await getOrder(order.orderId)).status).toBe("failed");
    expect(await getStock(tote.id)).toBe(3);
  });

  test("an expired session releases the stock", async () => {
    const { order, session, tote } = await setup();

    expect(await apply(session({ status: "expired", payment_status: "unpaid" }), "checkout.session.expired")).toBe("release");
    expect(await getOrder(order.orderId)).toMatchObject({ status: "expired", paidAt: null });
    expect(await getStock(tote.id)).toBe(3);
  });

  test("an amount or currency mismatch is flagged for review, never paid", async () => {
    const { order, session } = await setup();

    expect(await apply(session({ amount_total: 100, payment_intent: "pi_test_short" }))).toBe("needs_review");
    expect(await getOrder(order.orderId)).toMatchObject({ status: "needs_review", stripePaymentIntentId: "pi_test_short", paidAt: null });
  });

  test("a payment for an order whose stock was already released is flagged for review", async () => {
    const { order, session, tote } = await setup();
    await apply(session({ status: "expired", payment_status: "unpaid" }), "checkout.session.expired");

    expect(await apply(session())).toBe("needs_review");
    // paid_at and stock_released_at must never both be set (orders_paid_or_released_check).
    expect(await getOrder(order.orderId)).toMatchObject({ status: "needs_review", paidAt: null });
    expect(await getStock(tote.id)).toBe(3);
  });

  test("replays change nothing", async () => {
    const { order, session, tote } = await setup();
    await apply(session(), "checkout.session.completed");
    const paid = await getOrder(order.orderId);

    expect(await apply(session(), "checkout.session.completed")).toBe("none");
    expect(await apply(session({ status: "expired", payment_status: "unpaid" }), "checkout.session.expired")).toBe("none");
    expect(await getOrder(order.orderId)).toEqual(paid);
    expect(await getStock(tote.id)).toBe(2);
  });

  test("an unknown or malformed order reference is reported, not applied", async () => {
    await setup();
    expect(await apply(makeCheckoutSession({ orderId: "3f1c2b9e-8f44-4d7a-9a8e-1b2c3d4e5f60" }))).toBe("unknown_order");
    expect(await apply(makeCheckoutSession({ metadata: { orderId: "1; drop table orders" } }))).toBe("unknown_order");
    expect(await apply(makeCheckoutSession())).toBe("unknown_order");
  });

  test("a session that isn't the order's own is rejected", async () => {
    const { order, session } = await setup();
    expect(await apply(session({ id: "cs_test_someoneelse" }))).toBe("session_mismatch");
    expect((await getOrder(order.orderId)).status).toBe("pending");
  });
});

describe("processStripeEvent", () => {
  test("applies a checkout event once and records it", async () => {
    const { order, session } = await setup();
    const event = makeEvent("checkout.session.completed", session());

    expect(await processStripeEvent(event)).toBe("paid");
    expect(await processStripeEvent(event)).toBe("duplicate");
    expect((await getOrder(order.orderId)).status).toBe("paid");
    expect(await getStripeEvents()).toMatchObject([{ id: event.id, type: "checkout.session.completed" }]);
  });

  test("ignores events it doesn't handle", async () => {
    const { session } = await setup();
    expect(await processStripeEvent(makeEvent("payment_intent.succeeded", session()))).toBe("ignored");
    expect(await getStripeEvents()).toEqual([]);
  });

  test("a failure rolls back the event record, so Stripe's retry is processed", async () => {
    const { order, session } = await setup();
    // Shipping details without an address make applying the session throw mid-transaction.
    const broken = session({ collected_information: { shipping_details: { name: "Ada" } } as Stripe.Checkout.Session["collected_information"] });
    const event = makeEvent("checkout.session.completed", broken);

    await expect(processStripeEvent(event)).rejects.toThrow();
    expect(await getStripeEvents()).toEqual([]);
    expect((await getOrder(order.orderId)).status).toBe("pending");

    expect(await processStripeEvent({ ...event, data: { object: session() } } as Stripe.Event)).toBe("paid");
  });
});
