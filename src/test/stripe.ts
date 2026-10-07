import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { vi } from "vitest";

// Stand-in for `@/lib/stripe`, installed for every integration test by setup-integration.ts.
// API calls are `vi.fn`s that fail until a test stubs them, so nothing reaches Stripe's
// network. Webhook signing and verification use the real SDK, which works offline.

const sdk = new Stripe("sk_test_offline");

function notStubbed(method: string) {
  return () => Promise.reject(new Error(`Stripe ${method} isn't stubbed in this test.`));
}

export const stripeMock = {
  checkout: {
    sessions: {
      create: vi.fn(),
      retrieve: vi.fn(),
      expire: vi.fn(),
    },
  },
  webhooks: sdk.webhooks,
};

/** Restores the "not stubbed" defaults. Runs before every integration test. */
export function resetStripeMock() {
  const { sessions } = stripeMock.checkout;
  sessions.create.mockReset().mockImplementation(notStubbed("checkout.sessions.create"));
  sessions.retrieve.mockReset().mockImplementation(notStubbed("checkout.sessions.retrieve"));
  sessions.expire.mockReset().mockImplementation(notStubbed("checkout.sessions.expire"));
}
resetStripeMock();

export function getStripe() {
  return stripeMock as unknown as Stripe;
}

const randomId = (prefix: string) => `${prefix}_${randomBytes(12).toString("hex")}`;

/** A Checkout Session as Stripe returns it; defaults to a completed, paid $40 session. */
export function makeCheckoutSession(
  overrides: Partial<Stripe.Checkout.Session> & { orderId?: string } = {},
): Stripe.Checkout.Session {
  const { orderId, ...rest } = overrides;
  const id = rest.id ?? randomId("cs_test");
  return {
    id,
    object: "checkout.session",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    amount_total: 4000,
    amount_subtotal: 4000,
    currency: "usd",
    client_reference_id: orderId ?? null,
    metadata: orderId ? { orderId } : {},
    payment_intent: randomId("pi_test"),
    customer_details: { email: "shopper@example.com" },
    collected_information: null,
    url: `https://checkout.stripe.com/c/pay/${id}`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    ...rest,
  } as Stripe.Checkout.Session;
}

/** A webhook event wrapping `session`. */
export function makeEvent(type: string, session: Stripe.Checkout.Session): Stripe.Event {
  return {
    id: randomId("evt_test"),
    object: "event",
    type,
    api_version: "2026-08-26.dahlia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: { object: session },
  } as Stripe.Event;
}

/**
 * A POST request carrying `event`, signed like Stripe signs it. Pass another `secret` to
 * produce a signature the route must reject.
 */
export function signedWebhookRequest(
  event: Stripe.Event,
  secret = process.env.STRIPE_WEBHOOK_SECRET ?? "",
) {
  const payload = JSON.stringify(event);
  const signature = sdk.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: payload,
  });
}

/** The error the SDK throws for an unknown session ID. */
export function invalidRequestError(message = "No such checkout.session") {
  return new Stripe.errors.StripeInvalidRequestError({ message, type: "invalid_request_error" });
}
