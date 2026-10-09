import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import {
  orderItems,
  orders,
  orderStatus,
  products,
  productStock,
  type ShippingDetails,
  stripeEvents,
} from "@/db/schema";
import type { BagLine } from "@/lib/bag";
import {
  buildCheckoutLines,
  CHECKOUT_CURRENCY,
  CHECKOUT_SESSION_TTL_SECONDS,
  type CheckoutEventType,
  type CheckoutLine,
  checkoutTotalCents,
  decideTransition,
  isCheckoutEventType,
  isCheckoutSessionId,
  isOrderId,
  MIN_CHARGE_CENTS,
  type OrderStatus,
  type OrderTransition,
} from "@/lib/checkout";
import { getStripe } from "@/lib/stripe";

// Orders and Stripe Checkout, server side. Prices, totals and stock come only from Postgres;
// an order only becomes "paid" from a verified webhook or a session retrieved from Stripe.
// Design: docs/plans/2026-10-06-stripe-checkout.md.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Keep the client-safe status union in step with the database enum.
const _statusesMatch: [OrderStatus] extends [(typeof orderStatus.enumValues)[number]]
  ? [(typeof orderStatus.enumValues)[number]] extends [OrderStatus]
    ? true
    : never
  : never = true;
void _statusesMatch;

/** Tags these sessions in the Stripe Dashboard. */
const INTEGRATION_IDENTIFIER = "atelier-bag-checkout-qhzvmrkt";
const SHIPPING_COUNTRIES = ["US"] as const;

function appUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL is not set.");
  return new URL(path, base).toString();
}

// ---------------------------------------------------------------------------------------------
// Reserving and releasing stock

export type Reservation =
  | { ok: true; orderId: string; totalCents: number; lines: CheckoutLine[] }
  | { ok: false; reason: "empty" | "below_minimum" };

/**
 * Revalidates the bag against locked stock rows, decrements stock and records a pending order
 * with snapshots of the database prices, all in one transaction.
 */
export async function reserveOrder({
  bag,
  userId,
  email,
}: {
  bag: BagLine[];
  userId: string | null;
  email: string | null;
}): Promise<Reservation> {
  const ids = bag.map((line) => line.productId);
  if (ids.length === 0) return { ok: false, reason: "empty" };

  return db.transaction(async (tx) => {
    // Locking in product ID order keeps concurrent checkouts from deadlocking.
    const rows = await tx
      .select({
        productId: products.id,
        name: products.name,
        priceCents: products.priceCents,
        imageSrc: products.imageSrc,
        stock: productStock.quantity,
      })
      .from(products)
      .innerJoin(productStock, eq(productStock.productId, products.id))
      .where(inArray(products.id, ids))
      .orderBy(asc(products.id))
      .for("update", { of: productStock });

    const lines = buildCheckoutLines(bag, rows);
    if (lines.length === 0) return { ok: false, reason: "empty" } as const;
    const totalCents = checkoutTotalCents(lines);
    if (totalCents < MIN_CHARGE_CENTS) return { ok: false, reason: "below_minimum" } as const;

    for (const line of [...lines].sort((a, b) => a.productId - b.productId)) {
      const updated = await tx
        .update(productStock)
        .set({ quantity: sql`${productStock.quantity} - ${line.quantity}` })
        .where(
          and(
            eq(productStock.productId, line.productId),
            sql`${productStock.quantity} >= ${line.quantity}`,
          ),
        )
        .returning({ productId: productStock.productId });
      // Unreachable while the rows are locked; throwing rolls the whole reservation back.
      if (updated.length === 0) throw new Error(`Stock changed for product ${line.productId}.`);
    }

    const [order] = await tx
      .insert(orders)
      .values({
        userId,
        email,
        currency: CHECKOUT_CURRENCY,
        subtotalCents: totalCents,
        totalCents,
      })
      .returning({ id: orders.id });

    await tx.insert(orderItems).values(
      lines.map((line) => ({
        orderId: order.id,
        productId: line.productId,
        productName: line.productName,
        unitPriceCents: line.unitPriceCents,
        quantity: line.quantity,
      })),
    );

    return { ok: true, orderId: order.id, totalCents, lines } as const;
  });
}

/**
 * Returns an order's reserved stock and moves it to `status`. Only pending or processing orders
 * that still hold stock are released, so calling it twice is harmless.
 */
export async function releaseOrder(tx: Tx, orderId: string, status: "expired" | "failed") {
  const released = await tx
    .update(orders)
    .set({ status, stockReleasedAt: new Date() })
    .where(
      and(
        eq(orders.id, orderId),
        isNull(orders.stockReleasedAt),
        inArray(orders.status, ["pending", "processing"]),
      ),
    )
    .returning({ id: orders.id });
  if (released.length === 0) return false;

  const items = await tx
    .select({ productId: orderItems.productId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.productId));

  for (const item of items) {
    // Products deleted since checkout have nothing to return stock to.
    if (item.productId === null) continue;
    await tx
      .update(productStock)
      .set({ quantity: sql`${productStock.quantity} + ${item.quantity}` })
      .where(eq(productStock.productId, item.productId));
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Stripe Checkout Sessions

/** Creates the hosted Checkout page for a reserved order and records its session ID. */
export async function createCheckoutSession(
  reservation: Extract<Reservation, { ok: true }>,
  customerEmail: string | null,
) {
  const { orderId, lines } = reservation;
  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      line_items: lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: CHECKOUT_CURRENCY,
          unit_amount: line.unitPriceCents,
          product_data: {
            name: line.productName,
            images: line.imageSrc.startsWith("https://") ? [line.imageSrc] : undefined,
            metadata: { productId: String(line.productId) },
          },
        },
      })),
      client_reference_id: orderId,
      metadata: { orderId },
      payment_intent_data: { metadata: { orderId } },
      customer_email: customerEmail ?? undefined,
      shipping_address_collection: { allowed_countries: [...SHIPPING_COUNTRIES] },
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_TTL_SECONDS,
      success_url: `${appUrl("/checkout/success")}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: appUrl(`/checkout/cancel?order=${orderId}`),
      integration_identifier: INTEGRATION_IDENTIFIER,
    },
    // A retried request for the same order returns the same session instead of a second one.
    { idempotencyKey: `checkout-${orderId}` },
  );

  if (!session.url) throw new Error(`Checkout Session ${session.id} has no URL.`);
  await db
    .update(orders)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(orders.id, orderId));
  return session.url;
}

/** Marks an order whose Checkout Session could not be created as failed and returns its stock. */
export async function failOrder(orderId: string) {
  await db.transaction((tx) => releaseOrder(tx, orderId, "failed"));
}

/**
 * Ends this browser's earlier checkout so its reservation doesn't block a new one or linger
 * after a cancel. Stripe is asked first: if the session was paid in the meantime, the order
 * follows Stripe instead of being released. Returns where the order ended up.
 */
export async function abandonCheckout(
  orderId: string,
): Promise<{ status: OrderStatus; sessionId: string | null } | undefined> {
  if (!isOrderId(orderId)) return undefined;
  const [order] = await db
    .select({ status: orders.status, sessionId: orders.stripeCheckoutSessionId })
    .from(orders)
    .where(eq(orders.id, orderId));
  if (!order) return undefined;
  if (order.status !== "pending") return order;

  if (!order.sessionId) {
    await failOrder(orderId);
  } else {
    const stripe = getStripe();
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.expire(order.sessionId);
    } catch {
      // Already complete or expired: apply whatever state Stripe reports.
      session = await stripe.checkout.sessions.retrieve(order.sessionId);
    }
    await db.transaction((tx) => applyCheckoutSession(tx, session));
  }

  const status = await getOrderStatus(orderId);
  return status ? { status, sessionId: order.sessionId } : undefined;
}

export type OpenCheckout = {
  orderId: string;
  /** Stripe's hosted page, or null when Stripe couldn't be reached. */
  url: string | null;
  /** Whole minutes until Stripe expires the session and the hold is released. */
  minutesLeft: number;
  totalCents: number;
  items: { id: number; productName: string; quantity: number }[];
};

/**
 * This browser's checkout that is still waiting for payment, if any. Settles it first when
 * Stripe already has a final answer (expired, paid), so only a genuinely open session is
 * returned.
 */
export async function getOpenCheckout(orderId: string | undefined): Promise<OpenCheckout | null> {
  if (!isOrderId(orderId)) return null;
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.status, "pending")),
    columns: { id: true, totalCents: true, createdAt: true, stripeCheckoutSessionId: true },
    with: { items: { columns: { id: true, productName: true, quantity: true }, orderBy: asc(orderItems.id) } },
  });
  if (!order?.stripeCheckoutSessionId) return null;

  let url: string | null = null;
  let expiresAt = new Date(order.createdAt.getTime() + CHECKOUT_SESSION_TTL_SECONDS * 1000);
  try {
    const session = await syncCheckoutSession(order.stripeCheckoutSessionId);
    if (session?.status !== "open") return null;
    url = session.url;
    expiresAt = new Date(session.expires_at * 1000);
  } catch (error) {
    // Stripe unreachable: still show the hold, just without a way back to the payment page.
    console.error(`Couldn't check Checkout Session for order ${orderId}`, error);
  }
  const minutesLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 60_000);
  if (minutesLeft <= 0) return null;

  return { orderId: order.id, url, minutesLeft, totalCents: order.totalCents, items: order.items };
}

// ---------------------------------------------------------------------------------------------
// Applying Stripe's view of a session

function paymentIntentId(session: Stripe.Checkout.Session) {
  const intent = session.payment_intent;
  return typeof intent === "string" ? intent : (intent?.id ?? null);
}

function shippingDetails(session: Stripe.Checkout.Session): ShippingDetails | null {
  const shipping = session.collected_information?.shipping_details;
  if (!shipping) return null;
  const { address } = shipping;
  return {
    name: shipping.name,
    address: {
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postal_code,
      country: address.country,
    },
  };
}

export type ApplyResult = OrderTransition["kind"] | "unknown_order" | "session_mismatch";

/**
 * Moves the session's order to the state Stripe reports. Locks the order row and only updates
 * from the expected states, so it's safe to call from the webhook and the success page at once.
 */
export async function applyCheckoutSession(
  tx: Tx,
  session: Stripe.Checkout.Session,
  eventType?: CheckoutEventType,
): Promise<ApplyResult> {
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!isOrderId(orderId)) return "unknown_order";

  const [order] = await tx
    .select({
      status: orders.status,
      totalCents: orders.totalCents,
      currency: orders.currency,
      sessionId: orders.stripeCheckoutSessionId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .for("update");
  if (!order) return "unknown_order";
  if (order.sessionId !== session.id) return "session_mismatch";

  const transition = decideTransition(
    order,
    {
      status: session.status,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
    },
    eventType,
  );

  switch (transition.kind) {
    case "paid":
      await tx
        .update(orders)
        .set({
          status: "paid",
          paidAt: new Date(),
          stripePaymentIntentId: paymentIntentId(session),
          email: sql`coalesce(${session.customer_details?.email ?? null}, ${orders.email})`,
          shippingDetails: shippingDetails(session),
        })
        .where(and(eq(orders.id, orderId), inArray(orders.status, ["pending", "processing"])));
      break;
    case "processing":
      await tx
        .update(orders)
        .set({
          status: "processing",
          stripePaymentIntentId: paymentIntentId(session),
          email: sql`coalesce(${session.customer_details?.email ?? null}, ${orders.email})`,
          shippingDetails: shippingDetails(session),
        })
        .where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
      break;
    case "release":
      await releaseOrder(tx, orderId, transition.status);
      break;
    case "needs_review":
      console.error(`Order ${orderId} needs review: ${transition.reason}`);
      await tx
        .update(orders)
        .set({ status: "needs_review", stripePaymentIntentId: paymentIntentId(session) })
        .where(eq(orders.id, orderId));
      break;
    case "none":
      break;
  }
  return transition.kind;
}

/**
 * Applies a verified webhook event once. The event ID is recorded in the same transaction as
 * the order change, so a failure rolls both back and Stripe's retry is processed normally.
 */
export async function processStripeEvent(
  event: Stripe.Event,
): Promise<ApplyResult | "ignored" | "duplicate"> {
  if (!isCheckoutEventType(event.type)) return "ignored";
  const eventType = event.type;
  const session = event.data.object as Stripe.Checkout.Session;

  return db.transaction(async (tx) => {
    const recorded = await tx
      .insert(stripeEvents)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: stripeEvents.id });
    if (recorded.length === 0) return "duplicate";
    return applyCheckoutSession(tx, session, eventType);
  });
}

/** Retrieves a session from Stripe and applies it. Null when Stripe doesn't know the ID. */
export async function syncCheckoutSession(sessionId: string) {
  if (!isCheckoutSessionId(sessionId)) return null;
  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (error) {
    if ((error as { type?: string }).type === "StripeInvalidRequestError") return null;
    throw error;
  }
  await db.transaction((tx) => applyCheckoutSession(tx, session));
  return session;
}

// ---------------------------------------------------------------------------------------------
// Reads

/** The order behind a Checkout Session, as stored in our database. */
export async function getOrderBySession(sessionId: string) {
  return db.query.orders.findFirst({
    where: eq(orders.stripeCheckoutSessionId, sessionId),
    columns: { id: true, status: true, email: true, totalCents: true, currency: true },
    with: {
      items: {
        columns: { id: true, productName: true, unitPriceCents: true, quantity: true },
        orderBy: asc(orderItems.id),
      },
    },
  });
}

export async function getOrderStatus(orderId: string) {
  if (!isOrderId(orderId)) return undefined;
  const [order] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId));
  return order?.status;
}

/** Pending or processing orders older than `minutes`, oldest first. */
export async function getStaleOrders(minutes: number) {
  return db
    .select({ id: orders.id, status: orders.status, sessionId: orders.stripeCheckoutSessionId })
    .from(orders)
    .where(
      and(
        inArray(orders.status, ["pending", "processing"]),
        lt(orders.createdAt, sql`now() - make_interval(mins => ${minutes})`),
      ),
    )
    .orderBy(asc(orders.createdAt));
}

export type ReconcileResult =
  | { orderId: string; outcome: "released" }
  | { orderId: string; outcome: "synced"; session: Stripe.Checkout.Session | null }
  | { orderId: string; outcome: "error"; error: unknown };

/**
 * Settles checkouts whose webhooks were missed: each stale pending or processing order is
 * released when it never got a session, otherwise its session is retrieved from Stripe and
 * applied like the webhook would. One order failing doesn't stop the others.
 */
export async function reconcileStaleOrders(minutes: number): Promise<ReconcileResult[]> {
  const results: ReconcileResult[] = [];
  for (const order of await getStaleOrders(minutes)) {
    try {
      if (!order.sessionId) {
        // The Checkout Session was never created, so nothing can be paid.
        await failOrder(order.id);
        results.push({ orderId: order.id, outcome: "released" });
      } else {
        const session = await syncCheckoutSession(order.sessionId);
        results.push({ orderId: order.id, outcome: "synced", session });
      }
    } catch (error) {
      results.push({ orderId: order.id, outcome: "error", error });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------------------------
// Customer order history

/**
 * Orders a customer placed: Stripe completed the checkout, whether payment then succeeded,
 * is still settling, failed (async), or is under review. Open or abandoned checkouts aren't
 * orders, and session-creation failures never reached Stripe (no payment intent).
 */
const placedOrder = or(
  inArray(orders.status, ["paid", "processing", "needs_review"]),
  and(eq(orders.status, "failed"), isNotNull(orders.stripePaymentIntentId)),
);

/** The signed-in customer's placed orders, newest first. Scoped by `userId` in SQL. */
export async function getCustomerOrders(userId: string, limit = 100) {
  return db.query.orders.findMany({
    where: and(eq(orders.userId, userId), placedOrder),
    columns: { id: true, status: true, totalCents: true, createdAt: true },
    with: { items: { columns: { quantity: true } } },
    orderBy: desc(orders.createdAt),
    limit,
  });
}

/** One of the customer's placed orders, or undefined when it isn't theirs (or doesn't exist). */
export async function getCustomerOrder(userId: string, orderId: string) {
  if (!isOrderId(orderId)) return undefined;
  return db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.userId, userId), placedOrder),
    columns: {
      id: true,
      status: true,
      email: true,
      subtotalCents: true,
      totalCents: true,
      shippingDetails: true,
      createdAt: true,
      updatedAt: true,
      paidAt: true,
    },
    with: {
      items: {
        columns: { id: true, productName: true, unitPriceCents: true, quantity: true },
        orderBy: asc(orderItems.id),
        with: { product: { columns: { slug: true, imageSrc: true, imageAlt: true } } },
      },
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Admin order views. Callers must call requireAdmin() first: these aren't scoped to a user.

/** Placed orders from every customer and guest, newest first, optionally of one status. */
export async function getAdminOrders({ status, limit = 100 }: { status?: OrderStatus; limit?: number } = {}) {
  return db.query.orders.findMany({
    where: status ? and(placedOrder, eq(orders.status, status)) : placedOrder,
    columns: { id: true, status: true, email: true, totalCents: true, createdAt: true },
    with: {
      user: { columns: { name: true, email: true } },
      items: { columns: { quantity: true } },
    },
    orderBy: desc(orders.createdAt),
    limit,
  });
}

/** Any placed order with the details staff need; undefined for an invalid or unplaced ID. */
export async function getAdminOrder(orderId: string) {
  if (!isOrderId(orderId)) return undefined;
  return db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), placedOrder),
    columns: {
      id: true,
      status: true,
      email: true,
      currency: true,
      subtotalCents: true,
      totalCents: true,
      shippingDetails: true,
      stripeCheckoutSessionId: true,
      stripePaymentIntentId: true,
      createdAt: true,
      updatedAt: true,
      paidAt: true,
      stockReleasedAt: true,
    },
    with: {
      user: { columns: { id: true, name: true, email: true } },
      items: {
        columns: { id: true, productId: true, productName: true, unitPriceCents: true, quantity: true },
        orderBy: asc(orderItems.id),
        with: { product: { columns: { slug: true, imageSrc: true } } },
      },
    },
  });
}
