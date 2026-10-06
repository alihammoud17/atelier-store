// Checkout types and pure helpers. Client-safe: never import `@/db` or Stripe here.
// Server-side order handling lives in `@/lib/orders`.
import type { BagLine } from "@/lib/bag";

/** httpOnly cookie holding the ID of this browser's most recent checkout order. */
export const CHECKOUT_COOKIE = "atelier_checkout";
export const CHECKOUT_CURRENCY = "usd";
/** Stripe's minimum is 30 minutes; the extra minute absorbs clock skew. Also bounds how long stock is held. */
export const CHECKOUT_SESSION_TTL_SECONDS = 31 * 60;
/** Stripe's minimum charge for USD. */
export const MIN_CHARGE_CENTS = 50;

export type OrderStatus = "pending" | "processing" | "paid" | "expired" | "failed" | "needs_review";

/** A product row read (and locked) from Postgres while reserving stock. */
export type StockRow = {
  productId: number;
  name: string;
  priceCents: number;
  imageSrc: string;
  stock: number;
};

/** What is charged for one product: always built from database rows, never from the client. */
export type CheckoutLine = {
  productId: number;
  productName: string;
  unitPriceCents: number;
  imageSrc: string;
  quantity: number;
};

/**
 * Bag lines resolved against live rows, in bag order. Quantities are clamped to stock and
 * missing or sold-out products are dropped, matching what `/bag` shows.
 */
export function buildCheckoutLines(bag: BagLine[], rows: StockRow[]): CheckoutLine[] {
  const byId = new Map(rows.map((row) => [row.productId, row]));
  const lines: CheckoutLine[] = [];
  for (const { productId, quantity: requested } of bag) {
    const row = byId.get(productId);
    if (!row) continue;
    const quantity = Math.min(requested, row.stock);
    if (quantity <= 0) continue;
    lines.push({
      productId,
      productName: row.name,
      unitPriceCents: row.priceCents,
      imageSrc: row.imageSrc,
      quantity,
    });
  }
  return lines;
}

export function checkoutTotalCents(lines: Pick<CheckoutLine, "unitPriceCents" | "quantity">[]) {
  return lines.reduce((total, line) => total + line.unitPriceCents * line.quantity, 0);
}

export type CheckoutEventType =
  | "checkout.session.completed"
  | "checkout.session.async_payment_succeeded"
  | "checkout.session.async_payment_failed"
  | "checkout.session.expired";

export const CHECKOUT_EVENT_TYPES: readonly CheckoutEventType[] = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
];

export function isCheckoutEventType(type: string): type is CheckoutEventType {
  return (CHECKOUT_EVENT_TYPES as readonly string[]).includes(type);
}

/** The parts of a Stripe Checkout Session that decide an order's state. */
export type SessionSnapshot = {
  /** "open" | "complete" | "expired" */
  status: string | null;
  /** "paid" | "unpaid" | "no_payment_required" */
  paymentStatus: string;
  amountTotal: number | null;
  currency: string | null;
};

export type OrderTransition =
  | { kind: "none" }
  | { kind: "paid" }
  | { kind: "processing" }
  | { kind: "release"; status: "expired" | "failed" }
  | { kind: "needs_review"; reason: string };

const NONE: OrderTransition = { kind: "none" };

/**
 * Decides how an order moves given what Stripe says about its session. Shared by the webhook
 * (`eventType` set), the success page and the reconcile script (session retrieved from Stripe).
 * Only the states listed for each transition can move, so replays and out-of-order events
 * are no-ops.
 */
export function decideTransition(
  order: { status: OrderStatus; totalCents: number; currency: string },
  session: SessionSnapshot,
  eventType?: CheckoutEventType,
): OrderTransition {
  // An async payment that failed looks like "complete" + "unpaid", so only the event says so.
  if (eventType === "checkout.session.async_payment_failed") {
    return order.status === "pending" || order.status === "processing"
      ? { kind: "release", status: "failed" }
      : NONE;
  }

  if (session.status === "expired") {
    return order.status === "pending" ? { kind: "release", status: "expired" } : NONE;
  }

  if (session.status !== "complete") return NONE;

  if (session.paymentStatus === "paid") {
    if (order.status === "paid" || order.status === "needs_review") return NONE;
    if (session.amountTotal !== order.totalCents || session.currency !== order.currency) {
      return {
        kind: "needs_review",
        reason: `Stripe charged ${session.amountTotal} ${session.currency}, order expects ${order.totalCents} ${order.currency}.`,
      };
    }
    // Money arrived for an order whose stock was already released.
    if (order.status === "expired" || order.status === "failed") {
      return { kind: "needs_review", reason: `Payment received for a ${order.status} order.` };
    }
    return { kind: "paid" };
  }

  if (session.paymentStatus === "unpaid") {
    return order.status === "pending" ? { kind: "processing" } : NONE;
  }

  // "no_payment_required" can't happen for orders above MIN_CHARGE_CENTS.
  return order.status === "pending" || order.status === "processing"
    ? { kind: "needs_review", reason: `Unexpected payment status "${session.paymentStatus}".` }
    : NONE;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHECKOUT_SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{1,255}$/;

export function isOrderId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isCheckoutSessionId(value: unknown): value is string {
  return typeof value === "string" && CHECKOUT_SESSION_ID.test(value);
}

/** Short customer-facing reference for an order ID. */
export function orderReference(orderId: string) {
  return orderId.slice(0, 8).toUpperCase();
}

/** Result of `startCheckout`, shaped for `useActionState`. It only returns on failure. */
export type CheckoutActionState = { message: string } | null;
