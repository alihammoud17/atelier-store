// Run with: pnpm test (or pnpm exec vitest run tests/unit/lib/checkout.test.ts)
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  buildCheckoutLines,
  checkoutTotalCents,
  decideTransition,
  isCheckoutEventType,
  isCheckoutSessionId,
  isOrderId,
  type OrderStatus,
  type SessionSnapshot,
} from "@/lib/checkout";

const row = (productId: number, stock: number, priceCents = 1000) => ({
  productId,
  name: `Product ${productId}`,
  priceCents,
  imageSrc: "https://images.unsplash.com/x",
  stock,
});

test("buildCheckoutLines keeps bag order and uses database prices", () => {
  const lines = buildCheckoutLines(
    [
      { productId: 2, quantity: 1 },
      { productId: 1, quantity: 3 },
    ],
    [row(1, 10, 500), row(2, 10, 2500)],
  );
  assert.deepEqual(
    lines.map((line) => [line.productId, line.quantity, line.unitPriceCents]),
    [
      [2, 1, 2500],
      [1, 3, 500],
    ],
  );
  assert.equal(checkoutTotalCents(lines), 2500 + 1500);
});

test("buildCheckoutLines clamps to stock and drops sold-out and unknown products", () => {
  const lines = buildCheckoutLines(
    [
      { productId: 1, quantity: 5 },
      { productId: 2, quantity: 1 },
      { productId: 3, quantity: 1 },
    ],
    [row(1, 2), row(2, 0)],
  );
  assert.deepEqual(
    lines.map((line) => [line.productId, line.quantity]),
    [[1, 2]],
  );
});

const order = (status: OrderStatus) => ({ status, totalCents: 4000, currency: "usd" });
const session = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  status: "complete",
  paymentStatus: "paid",
  amountTotal: 4000,
  currency: "usd",
  ...overrides,
});

test("a paid, matching session marks pending and processing orders paid", () => {
  assert.deepEqual(decideTransition(order("pending"), session(), "checkout.session.completed"), { kind: "paid" });
  assert.deepEqual(
    decideTransition(order("processing"), session(), "checkout.session.async_payment_succeeded"),
    { kind: "paid" },
  );
  assert.deepEqual(decideTransition(order("pending"), session()), { kind: "paid" });
});

test("replays and late events don't move a settled order", () => {
  for (const status of ["paid", "needs_review"] as const) {
    assert.deepEqual(decideTransition(order(status), session(), "checkout.session.completed"), { kind: "none" });
  }
  // completed(unpaid) arriving after the async result
  assert.deepEqual(
    decideTransition(order("paid"), session({ paymentStatus: "unpaid" }), "checkout.session.completed"),
    { kind: "none" },
  );
  assert.deepEqual(
    decideTransition(order("failed"), session({ paymentStatus: "unpaid" }), "checkout.session.completed"),
    { kind: "none" },
  );
  assert.deepEqual(
    decideTransition(order("expired"), session({ status: "expired", paymentStatus: "unpaid" }), "checkout.session.expired"),
    { kind: "none" },
  );
});

test("amount or currency mismatches are never marked paid", () => {
  assert.equal(decideTransition(order("pending"), session({ amountTotal: 1 })).kind, "needs_review");
  assert.equal(decideTransition(order("pending"), session({ amountTotal: null })).kind, "needs_review");
  assert.equal(decideTransition(order("pending"), session({ currency: "eur" })).kind, "needs_review");
});

test("payment for an order whose stock was released needs review", () => {
  assert.equal(decideTransition(order("expired"), session()).kind, "needs_review");
  assert.equal(decideTransition(order("failed"), session()).kind, "needs_review");
});

test("an unpaid completed session (async payment) moves pending to processing only", () => {
  const unpaid = session({ paymentStatus: "unpaid" });
  assert.deepEqual(decideTransition(order("pending"), unpaid, "checkout.session.completed"), { kind: "processing" });
  assert.deepEqual(decideTransition(order("processing"), unpaid), { kind: "none" });
});

test("async failure and expiry release stock", () => {
  const unpaid = session({ paymentStatus: "unpaid" });
  for (const status of ["pending", "processing"] as const) {
    assert.deepEqual(decideTransition(order(status), unpaid, "checkout.session.async_payment_failed"), {
      kind: "release",
      status: "failed",
    });
  }
  const expired = session({ status: "expired", paymentStatus: "unpaid" });
  assert.deepEqual(decideTransition(order("pending"), expired, "checkout.session.expired"), {
    kind: "release",
    status: "expired",
  });
  assert.deepEqual(decideTransition(order("processing"), expired), { kind: "none" });
});

test("open sessions change nothing", () => {
  assert.deepEqual(decideTransition(order("pending"), session({ status: "open", paymentStatus: "unpaid" })), {
    kind: "none",
  });
});

test("ID guards", () => {
  assert.ok(isOrderId("3f1c2b9e-8f44-4d7a-9a8e-1b2c3d4e5f60"));
  assert.ok(!isOrderId("1; drop table orders"));
  assert.ok(!isOrderId(undefined));
  assert.ok(isCheckoutSessionId("cs_test_a1B2c3"));
  assert.ok(!isCheckoutSessionId("cs_test_"));
  assert.ok(!isCheckoutSessionId(["cs_test_a1"]));
  assert.ok(!isCheckoutSessionId("pi_123"));
  assert.ok(isCheckoutEventType("checkout.session.expired"));
  assert.ok(!isCheckoutEventType("payment_intent.succeeded"));
});
