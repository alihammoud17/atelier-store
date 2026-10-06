import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { products } from "./catalog-schema";
import { timestamps } from "./columns";

// Checkout orders. Amounts are integer cents copied from our own catalog at checkout, never
// from the client; payment status only changes on Stripe's word (verified webhook or a
// server-side session retrieve). See docs/plans/2026-10-06-stripe-checkout.md.

export const orderStatus = pgEnum("order_status", [
  /** Checkout Session open, stock reserved. */
  "pending",
  /** Checkout completed with an async payment method that hasn't settled; stock stays reserved. */
  "processing",
  /** Payment confirmed by Stripe. */
  "paid",
  /** Session expired, abandoned or replaced; stock released. */
  "expired",
  /** Async payment failed or session creation failed; stock released. */
  "failed",
  /** Stripe's amount or currency didn't match the order; never fulfilled automatically. */
  "needs_review",
]);

export type OrderStatus = (typeof orderStatus.enumValues)[number];

/** Shipping name and address as collected by Stripe Checkout. */
export type ShippingDetails = {
  name: string;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };
};

export const orders = pgTable(
  "orders",
  {
    /** Unguessable, so it can be shown to customers and used as Stripe metadata. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** The signed-in customer who checked out; null for guest checkout. */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** Signed-in user's email at checkout, then Stripe's customer_details.email. */
    email: text("email"),
    status: orderStatus("status").notNull().default("pending"),
    currency: text("currency").notNull().default("usd"),
    subtotalCents: integer("subtotal_cents").notNull(),
    /** What Stripe must charge: subtotal for now (free shipping, no tax). */
    totalCents: integer("total_cents").notNull(),
    /** Set right after the Checkout Session is created. */
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    /** Set once Stripe reports a payment. */
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    shippingDetails: jsonb("shipping_details").$type<ShippingDetails>(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Set when reserved stock is returned to product_stock; guards against double release. */
    stockReleasedAt: timestamp("stock_released_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("orders_user_id_created_at_idx").on(table.userId, table.createdAt),
    index("orders_status_created_at_idx").on(table.status, table.createdAt),
    check("orders_subtotal_cents_check", sql`${table.subtotalCents} >= 0`),
    check("orders_total_cents_check", sql`${table.totalCents} >= 0`),
    check("orders_currency_check", sql`${table.currency} ~ '^[a-z]{3}$'`),
    check("orders_paid_at_check", sql`${table.status} <> 'paid' or ${table.paidAt} is not null`),
    // A paid order keeps its stock; a released order was never paid.
    check(
      "orders_paid_or_released_check",
      sql`${table.paidAt} is null or ${table.stockReleasedAt} is null`,
    ),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Null once the product is deleted; the snapshot columns keep the history. */
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    unique("order_items_order_id_product_id_unique").on(table.orderId, table.productId),
    index("order_items_product_id_idx").on(table.productId),
    check("order_items_unit_price_cents_check", sql`${table.unitPriceCents} >= 0`),
    check("order_items_quantity_check", sql`${table.quantity} > 0`),
  ],
);

/** Stripe webhook events already processed, so redelivered events are skipped. */
export const stripeEvents = pgTable("stripe_events", {
  /** Stripe event ID, e.g. evt_… */
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(user, { fields: [orders.userId], references: [user.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
