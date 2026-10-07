// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/app/api/webhooks/stripe/route.test.ts)
import type Stripe from "stripe";
import { afterEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { createReservedOrder } from "@tests/helpers/checkout";
import { createProduct } from "@tests/helpers/factories";
import { getOrder, getStock, getStripeEvents } from "@tests/helpers/queries";
import { makeCheckoutSession, makeEvent, signedWebhookRequest } from "@tests/helpers/stripe";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function paidEvent(overrides: Partial<Stripe.Checkout.Session> = {}) {
  const tote = await createProduct({ priceCents: 48_000, stock: 1 });
  const order = await createReservedOrder([{ product: tote }]);
  const session = makeCheckoutSession({ id: order.sessionId ?? undefined, orderId: order.orderId, amount_total: 48_000, ...overrides });
  return { tote, order, event: makeEvent("checkout.session.completed", session) };
}

describe("POST /api/webhooks/stripe", () => {
  test("applies a signed event and records it", async () => {
    const { order, event } = await paidEvent();

    const response = await POST(signedWebhookRequest(event));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, result: "paid" });
    expect((await getOrder(order.orderId)).status).toBe("paid");
    expect(await getStripeEvents()).toMatchObject([{ id: event.id }]);
  });

  test("acknowledges a redelivered event without applying it again", async () => {
    const { event } = await paidEvent();
    await POST(signedWebhookRequest(event));

    const response = await POST(signedWebhookRequest(event));
    expect(await response.json()).toEqual({ received: true, result: "duplicate" });
  });

  test("acknowledges events it doesn't handle", async () => {
    const { event } = await paidEvent();
    const response = await POST(signedWebhookRequest({ ...event, type: "charge.refunded" } as Stripe.Event));
    expect(await response.json()).toEqual({ received: true, result: "ignored" });
  });

  test("rejects a request without a signature", async () => {
    const { order, event } = await paidEvent();
    const response = await POST(new Request("http://localhost:3000/api/webhooks/stripe", { method: "POST", body: JSON.stringify(event) }));

    expect(response.status).toBe(400);
    expect((await getOrder(order.orderId)).status).toBe("pending");
  });

  test("rejects a forged signature and a tampered body", async () => {
    const { order, event } = await paidEvent();

    expect((await POST(signedWebhookRequest(event, "whsec_attacker"))).status).toBe(400);

    const signed = signedWebhookRequest(event);
    const tampered = new Request(signed.url, {
      method: "POST",
      headers: signed.headers,
      body: JSON.stringify({ ...event, id: "evt_test_tampered" }),
    });
    expect((await POST(tampered)).status).toBe(400);

    expect((await getOrder(order.orderId)).status).toBe("pending");
    expect(await getStripeEvents()).toEqual([]);
  });

  test("fails closed when the webhook secret isn't configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const { event } = await paidEvent();

    expect((await POST(signedWebhookRequest(event, "whsec_test_offline"))).status).toBe(500);
  });

  test("returns 500 and commits nothing when processing fails, so Stripe retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { order, event, tote } = await paidEvent({
      collected_information: { shipping_details: { name: "Ada" } } as Stripe.Checkout.Session["collected_information"],
    });

    expect((await POST(signedWebhookRequest(event))).status).toBe(500);
    expect((await getOrder(order.orderId)).status).toBe("pending");
    expect(await getStock(tote.id)).toBe(0);
    expect(await getStripeEvents()).toEqual([]);
  });

  test("acknowledges events for unknown orders so Stripe stops retrying", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const event = makeEvent("checkout.session.completed", makeCheckoutSession({ orderId: "3f1c2b9e-8f44-4d7a-9a8e-1b2c3d4e5f60" }));

    const response = await POST(signedWebhookRequest(event));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, result: "unknown_order" });
    expect(console.warn).toHaveBeenCalled();
  });
});
