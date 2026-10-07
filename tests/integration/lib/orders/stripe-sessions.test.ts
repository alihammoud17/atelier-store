// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/lib/orders/stripe-sessions.test.ts)
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { CHECKOUT_SESSION_TTL_SECONDS } from "@/lib/checkout";
import { abandonCheckout, createCheckoutSession, getOpenCheckout, reserveOrder, syncCheckoutSession } from "@/lib/orders";
import { createReservedOrder } from "@tests/helpers/checkout";
import { createOrder, createProduct } from "@tests/helpers/factories";
import { getOrder, getStock } from "@tests/helpers/queries";
import { invalidRequestError, makeCheckoutSession, stripeMock } from "@tests/helpers/stripe";

const { sessions } = stripeMock.checkout;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("createCheckoutSession", () => {
  test("sends database prices to Stripe and stores the session ID", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-08T12:00:00Z"), toFake: ["Date"] });
    const coat = await createProduct({ name: "Coat", priceCents: 189_000, imageSrc: "https://images.unsplash.com/coat" });
    const local = await createProduct({ name: "Local", priceCents: 1_000, imageSrc: "/images/local.jpg" });
    const reservation = await reserveOrder({
      bag: [
        { productId: coat.id, quantity: 2 },
        { productId: local.id, quantity: 1 },
      ],
      userId: null,
      email: null,
    });
    if (!reservation.ok) throw new Error("expected a reservation");
    sessions.create.mockResolvedValue(makeCheckoutSession({ id: "cs_test_created", url: "https://checkout.stripe.com/c/pay/cs_test_created" }));

    const url = await createCheckoutSession(reservation, "shopper@example.com");

    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_test_created");
    expect((await getOrder(reservation.orderId)).stripeCheckoutSessionId).toBe("cs_test_created");
    const [params, options] = sessions.create.mock.calls[0];
    const { orderId } = reservation;
    expect(options).toEqual({ idempotencyKey: `checkout-${orderId}` });
    expect(params).toMatchObject({
      mode: "payment",
      client_reference_id: orderId,
      metadata: { orderId },
      payment_intent_data: { metadata: { orderId } },
      customer_email: "shopper@example.com",
      shipping_address_collection: { allowed_countries: ["US"] },
      expires_at: Math.floor(Date.parse("2026-10-08T12:00:00Z") / 1000) + CHECKOUT_SESSION_TTL_SECONDS,
      success_url: "http://localhost:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: `http://localhost:3000/checkout/cancel?order=${orderId}`,
    });
    expect(params.line_items).toEqual([
      {
        quantity: 2,
        price_data: {
          currency: "usd",
          unit_amount: 189_000,
          product_data: { name: "Coat", images: ["https://images.unsplash.com/coat"], metadata: { productId: String(coat.id) } },
        },
      },
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 1_000,
          product_data: { name: "Local", images: undefined, metadata: { productId: String(local.id) } },
        },
      },
    ]);
  });

  test("omits customer_email for guests", async () => {
    const tote = await createProduct();
    const reservation = await reserveOrder({ bag: [{ productId: tote.id, quantity: 1 }], userId: null, email: null });
    if (!reservation.ok) throw new Error("expected a reservation");
    sessions.create.mockResolvedValue(makeCheckoutSession());

    await createCheckoutSession(reservation, null);
    expect(sessions.create.mock.calls[0][0].customer_email).toBeUndefined();
  });

  test("throws when Stripe returns a session without a URL", async () => {
    const tote = await createProduct();
    const reservation = await reserveOrder({ bag: [{ productId: tote.id, quantity: 1 }], userId: null, email: null });
    if (!reservation.ok) throw new Error("expected a reservation");
    sessions.create.mockResolvedValue(makeCheckoutSession({ url: null }));

    await expect(createCheckoutSession(reservation, null)).rejects.toThrow(/has no URL/);
    expect((await getOrder(reservation.orderId)).stripeCheckoutSessionId).toBeNull();
  });
});

describe("abandonCheckout", () => {
  test("ignores malformed and unknown order IDs", async () => {
    expect(await abandonCheckout("not-an-order")).toBeUndefined();
    expect(await abandonCheckout("3f1c2b9e-8f44-4d7a-9a8e-1b2c3d4e5f60")).toBeUndefined();
    expect(sessions.expire).not.toHaveBeenCalled();
  });

  test("leaves an order that is no longer pending alone, without calling Stripe", async () => {
    const order = await createOrder({ status: "paid", stripeCheckoutSessionId: "cs_test_paid" });
    expect(await abandonCheckout(order.id)).toEqual({ status: "paid", sessionId: "cs_test_paid" });
    expect(sessions.expire).not.toHaveBeenCalled();
  });

  test("fails an order that never got a session and returns its stock", async () => {
    const tote = await createProduct({ stock: 1 });
    const { orderId } = await createReservedOrder([{ product: tote }], { sessionId: null });

    expect(await abandonCheckout(orderId)).toEqual({ status: "failed", sessionId: null });
    expect(await getStock(tote.id)).toBe(1);
  });

  test("expires the open session at Stripe and releases the stock", async () => {
    const tote = await createProduct({ priceCents: 48_000, stock: 1 });
    const { orderId, sessionId } = await createReservedOrder([{ product: tote }]);
    sessions.expire.mockResolvedValue(makeCheckoutSession({ id: sessionId ?? undefined, orderId, status: "expired", payment_status: "unpaid", amount_total: 48_000 }));

    expect(await abandonCheckout(orderId)).toEqual({ status: "expired", sessionId });
    expect(sessions.expire).toHaveBeenCalledWith(sessionId);
    expect(await getStock(tote.id)).toBe(1);
  });

  test("follows Stripe when the session was paid before it could be expired", async () => {
    const tote = await createProduct({ priceCents: 48_000, stock: 1 });
    const { orderId, sessionId } = await createReservedOrder([{ product: tote }]);
    sessions.expire.mockRejectedValue(invalidRequestError("Only open sessions can be expired."));
    sessions.retrieve.mockResolvedValue(makeCheckoutSession({ id: sessionId ?? undefined, orderId, amount_total: 48_000 }));

    expect(await abandonCheckout(orderId)).toEqual({ status: "paid", sessionId });
    expect(await getStock(tote.id)).toBe(0);
  });
});

describe("syncCheckoutSession", () => {
  test("never asks Stripe about a malformed session ID", async () => {
    expect(await syncCheckoutSession("pi_123")).toBeNull();
    expect(await syncCheckoutSession("cs_test_")).toBeNull();
    expect(sessions.retrieve).not.toHaveBeenCalled();
  });

  test("returns null for a session Stripe doesn't know", async () => {
    sessions.retrieve.mockRejectedValue(invalidRequestError());
    expect(await syncCheckoutSession("cs_test_unknown")).toBeNull();
  });

  test("rethrows other Stripe errors", async () => {
    sessions.retrieve.mockRejectedValue(new Error("connection reset"));
    await expect(syncCheckoutSession("cs_test_abc")).rejects.toThrow("connection reset");
  });

  test("applies the retrieved session to its order", async () => {
    const tote = await createProduct({ priceCents: 48_000 });
    const { orderId, sessionId } = await createReservedOrder([{ product: tote }]);
    const paid = makeCheckoutSession({ id: sessionId ?? undefined, orderId, amount_total: 48_000 });
    sessions.retrieve.mockResolvedValue(paid);

    expect(await syncCheckoutSession(sessionId ?? "")).toBe(paid);
    expect((await getOrder(orderId)).status).toBe("paid");
  });
});

describe("getOpenCheckout", () => {
  async function openOrder() {
    const tote = await createProduct({ name: "Tote", priceCents: 48_000, stock: 2 });
    const order = await createReservedOrder([{ product: tote, quantity: 2 }]);
    return { tote, ...order };
  }

  test("returns null for malformed IDs and orders that aren't pending or have no session", async () => {
    expect(await getOpenCheckout(undefined)).toBeNull();
    expect(await getOpenCheckout("nope")).toBeNull();
    const tote = await createProduct();
    const { orderId } = await createReservedOrder([{ product: tote }], { sessionId: null });
    expect(await getOpenCheckout(orderId)).toBeNull();
    const paid = await createOrder({ status: "paid", stripeCheckoutSessionId: "cs_test_done" });
    expect(await getOpenCheckout(paid.id)).toBeNull();
    expect(sessions.retrieve).not.toHaveBeenCalled();
  });

  test("describes an open session with its link and time left", async () => {
    const { orderId, sessionId } = await openOrder();
    sessions.retrieve.mockResolvedValue(
      makeCheckoutSession({
        id: sessionId ?? undefined,
        orderId,
        status: "open",
        payment_status: "unpaid",
        url: "https://checkout.stripe.com/c/pay/open",
        expires_at: Math.floor(Date.now() / 1000) + 10 * 60 - 5,
      }),
    );

    expect(await getOpenCheckout(orderId)).toEqual({
      orderId,
      url: "https://checkout.stripe.com/c/pay/open",
      minutesLeft: 10,
      totalCents: 96_000,
      items: [{ id: expect.any(Number), productName: "Tote", quantity: 2 }],
    });
  });

  test("settles a session Stripe already finished and returns null", async () => {
    const { orderId, sessionId } = await openOrder();
    sessions.retrieve.mockResolvedValue(makeCheckoutSession({ id: sessionId ?? undefined, orderId, amount_total: 96_000 }));

    expect(await getOpenCheckout(orderId)).toBeNull();
    expect((await getOrder(orderId)).status).toBe("paid");
  });

  test("still shows the hold, without a link, when Stripe is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { orderId } = await openOrder();
    sessions.retrieve.mockRejectedValue(new Error("ECONNRESET"));

    expect(await getOpenCheckout(orderId)).toMatchObject({ orderId, url: null, minutesLeft: 31, totalCents: 96_000 });
  });

  test("returns null once the hold has run out", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { orderId } = await openOrder();
    await db.update(orders).set({ createdAt: new Date(Date.now() - 40 * 60_000) }).where(eq(orders.id, orderId));
    sessions.retrieve.mockRejectedValue(new Error("ECONNRESET"));

    expect(await getOpenCheckout(orderId)).toBeNull();
  });
});
