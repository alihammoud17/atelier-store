# Stripe Checkout for the Atelier bag

- **Date:** 2026-10-06
- **Branch:** main
- **Goal:** Add Stripe-hosted Checkout for the bag. Orders live in Postgres, stock is reserved atomically, and payment is confirmed only by Stripe (webhook + server-side retrieve). Client-provided prices or payment status are never trusted.
- **Status:** done
- **Approval:** approved in plan mode

## Context

The bag (`atelier_bag` cookie, IDs + quantities only) resolves prices and stock live from Postgres (`getBag()` in `src/lib/bag-server.ts`, `getBagProducts()` in `src/lib/products.ts`), but `/bag` ends at a disabled "Checkout coming soon" button. There are no orders, no payment provider, and stock is never decremented. This plan adds Stripe-hosted Checkout (Checkout Sessions API, one-time payments) with orders in our database, stock reserved atomically, and payment confirmed only by Stripe (webhook + server-side session retrieval), never by the client.

Confirmed choices: **guests and signed-in customers can check out**, **stock is reserved when the Checkout Session is created**, **no tax yet** (no `automatic_tax` until a registration exists).

## Ownership: database vs Stripe

**Our database owns (source of truth)**
- Product identity, name, `price_cents`, currency (USD, as in `formatPrice`), and stock.
- Which products and quantities are bought: read from the bag cookie, but every price/name/stock value is re-read from Postgres inside the checkout transaction. The server action takes **no arguments**, so there's nothing client-supplied to trust except product IDs and quantities from the cookie.
- Orders, line-item snapshots (name + unit price at purchase time), order status, and stock reservations.

**Stripe owns**
- The payment page, card/wallet data, 3DS/SCA, the PaymentIntent and charge, payment method selection (dynamic payment methods; no `payment_method_types`).
- Collecting the customer's email (guests) and shipping address.
- The authoritative **payment status**, which we only read from verified webhooks or a server-side `checkout.sessions.retrieve`.
- No Stripe Products/Prices catalog sync: line items use inline `price_data` built from our DB, so there's a single price source.

## Database changes

New file `src/db/order-schema.ts`, re-exported from `src/db/schema.ts`; migration via `pnpm db:generate` → review SQL → `pnpm db:migrate` → commit `drizzle/0003_*.sql`.

```ts
export const orderStatus = pgEnum("order_status", [
  "pending",     // session open, stock reserved
  "processing",  // checkout completed, async payment (e.g. bank debit) not settled yet; stock stays reserved
  "paid",        // payment confirmed by Stripe
  "expired",     // session expired/abandoned or replaced; stock released
  "failed",      // async payment failed or session creation failed; stock released
  "needs_review" // Stripe amount/currency didn't match our order; never auto-fulfilled
]);

orders
  id                         uuid pk default gen_random_uuid()   // unguessable public reference
  user_id                    text null → user.id on delete set null   // null for guests
  email                      text null        // from session user, then Stripe customer_details
  status                     order_status not null default 'pending'
  currency                   text not null default 'usd'
  subtotal_cents             integer not null  check >= 0
  total_cents                integer not null  check >= 0   // = subtotal (free shipping, no tax)
  stripe_checkout_session_id text unique null  // set right after session creation
  stripe_payment_intent_id   text unique null
  shipping_details           jsonb null        // name + address from Stripe
  paid_at, stock_released_at timestamptz null
  created_at, updated_at     (shared timestamps helper)
  index (user_id, created_at), index (status, created_at)

order_items
  id               integer identity pk
  order_id         uuid not null → orders.id on delete cascade
  product_id       integer null → products.id on delete set null   // history survives product deletion
  product_name     text not null      // snapshot
  unit_price_cents integer not null check >= 0   // snapshot from DB, never from client
  quantity         integer not null check > 0
  unique (order_id, product_id)

stripe_events                       // webhook de-duplication ledger
  id           text pk               // Stripe event id, evt_…
  type         text not null
  processed_at timestamptz not null default now()
```

`product_stock` is unchanged; the existing `quantity >= 0` check is the last line of defense against overselling.

## Payment flow

1. **`/bag`**: replace the disabled button with a `<form action={startCheckout}>` submit button (disabled when the bag is empty or everything is sold out). Update "Taxes are calculated at checkout" copy.
2. **`startCheckout()`** in `src/app/checkout/actions.ts` (`"use server"`, no parameters):
   1. `readBag()`; `getSession()` (optional, never `requireSession`) to attach `user_id` / email.
   2. If the `atelier_checkout` httpOnly cookie points at a still-`pending` order, release it first (`releaseOrder(orderId, "expired")`) and call `stripe.checkout.sessions.expire()` on its session, so the same shopper's old reservation can't block a new attempt.
   3. **DB transaction**: `SELECT … FROM product_stock JOIN products WHERE product_id IN (…) ORDER BY product_id FOR UPDATE` (consistent lock order avoids deadlocks). Quantity per line = `min(requested, stock)`, sold-out lines skipped, exactly like `getBag()`. If nothing is left, return an error state and send the shopper back to `/bag`. Decrement `product_stock.quantity`, insert `orders` (`pending`, totals computed from DB prices) and `order_items` snapshots. Commit.
   4. **Create the Checkout Session** (outside the transaction), with Stripe idempotency key `checkout-${order.id}`:
      - `mode: "payment"`, `line_items[].price_data { currency: "usd", unit_amount: unit_price_cents, product_data: { name, images: [absolute image URL] } }`, `quantity`
      - `client_reference_id: order.id`, `metadata.orderId`, `payment_intent_data.metadata.orderId`
      - `customer_email` when signed in; `shipping_address_collection.allowed_countries`
      - `expires_at: now + 30 min` (Stripe's minimum), which bounds how long stock is held
      - `success_url: ${NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`, `cancel_url: ${NEXT_PUBLIC_APP_URL}/bag`
      - `integration_identifier: "atelier-bag-checkout-<8 random letters>"`
   5. If session creation throws: `releaseOrder(order.id, "failed")` and return an error message.
   6. Save `stripe_checkout_session_id`, set the `atelier_checkout` cookie (order id, httpOnly, 1h), then `redirect(session.url)` (outside any try/catch).
3. **Stripe-hosted page**: the shopper pays, or cancels (back to `/bag`, bag intact, reservation released on expiry or on their next checkout attempt).
4. **`/checkout/success`** (dynamic Server Component, `robots: noindex`): reads `session_id`, calls `confirmCheckoutSession(sessionId)`, which **retrieves the session from Stripe server-side** and applies the same idempotent transition as the webhook (covers webhook lag). Shows the order from **our DB**: "Thank you" for `paid`, "We're confirming your payment" for `processing`/`pending`. It shows only the order reference, items and totals (no address). A small client component calls a `clearBag()` server action when the order is paid and dispatches `bag-change`, since cookies can't be written during render.

## Webhook flow

Route: `src/app/api/webhooks/stripe/route.ts`, `POST` only, Node runtime.

1. `const body = await request.text()` (raw body), `stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature"), STRIPE_WEBHOOK_SECRET)`; respond 400 on failure. Nothing in the payload is trusted before this check passes.
2. Ignore unhandled event types with 200.
3. For handled types, run **one DB transaction**:
   1. `INSERT INTO stripe_events (id, type) … ON CONFLICT DO NOTHING RETURNING id`. If no row comes back, it's a duplicate delivery, so commit and return 200.
   2. Load the order by `session.metadata.orderId` with `FOR UPDATE`, and require `order.stripe_checkout_session_id === session.id`. Unknown order: log and return 200 (the event is recorded).
   3. Apply the transition with **guarded updates** (`WHERE status IN (…)`), so replays and out-of-order events are harmless:

| Event | Condition | Transition |
|---|---|---|
| `checkout.session.completed` | `payment_status === "paid"` and `amount_total === total_cents` and `currency === "usd"` | `pending/processing → paid`; store payment intent id, `customer_details.email`, shipping details, `paid_at` |
| `checkout.session.completed` | `payment_status === "unpaid"` (async method) | `pending → processing` (stock stays reserved) |
| `checkout.session.async_payment_succeeded` | same amount checks | `processing → paid` |
| `checkout.session.async_payment_failed` | none | `processing → failed` + release stock |
| `checkout.session.expired` | none | `pending → expired` + release stock |
| any paid event | amount or currency mismatch | `→ needs_review`, logged, never fulfilled |

4. Any thrown error rolls back the transaction (including the `stripe_events` row) and returns 500, so Stripe retries and the retry isn't treated as a duplicate.

The transitions live in `src/lib/orders.ts` (`server-only`) as `applyCheckoutSession(tx, session)`, `releaseOrder(tx, orderId, status)` and `markOrderPaid(...)`, shared by the webhook, the success page and the reconcile script. `releaseOrder` adds the item quantities back to `product_stock` and sets `stock_released_at`. It only acts when `stock_released_at IS NULL` and the status is `pending`/`processing`, so stock can never be released twice.

**Failure / abandonment summary**
- Card declined on the Stripe page: Stripe lets the shopper retry in the same session, and we do nothing.
- Shopper closes the tab or clicks back: the session expires after 30 min, then `checkout.session.expired` → `expired` + stock released.
- Shopper starts a new checkout: the previous pending order is expired immediately (step 2.2).
- Async payment fails: `async_payment_failed` → `failed` + stock released.
- Webhooks are down or events are missed: `pnpm orders:reconcile` (below) retrieves every `pending`/`processing` order older than 35 min from Stripe and applies the same transitions.

## Files

- **New:** `src/db/order-schema.ts`, `src/lib/stripe.ts` (`server-only`, `new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-08-26.dahlia" })`), `src/lib/orders.ts` (`server-only`; checkout transaction + state transitions), `src/app/checkout/actions.ts`, `src/app/checkout/success/page.tsx`, `src/app/api/webhooks/stripe/route.ts`, `src/components/checkout/clear-bag-on-success.tsx`, `src/db/reconcile-orders.ts`, `src/lib/orders.test.ts`.
- **Modified:** `src/db/schema.ts` (re-export), `src/app/bag/page.tsx` (checkout form + copy), `src/app/bag/actions.ts` (add `clearBag`), `.env.example` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`), `package.json` (`stripe` dependency, `orders:reconcile` script), `CLAUDE.md` (Checkout section).
- **Reused:** `readBag`/`writeBag` (`lib/bag-server.ts`), `getSession` (`lib/session.ts`), `formatPrice`, the `timestamps` pattern from `catalog-schema.ts`, `db` from `@/db` (no new pool), and the UI `Button`/`Heading`/`Text` components with design tokens (use the build-ui skill for the success page).

## Steps

- [x] Install `stripe` (Node SDK 22.x); add env vars to `.env.example`; create `src/lib/stripe.ts`. Use a restricted key (`rk_…`) with Checkout Sessions write permission, in a dedicated Stripe sandbox.
- [x] Add `order-schema.ts` (orders, order_items, stripe_events, `order_status` enum), re-export it, generate, review and apply the migration.
- [x] Implement `src/lib/orders.ts`: `reserveOrder` (locked stock read, decrement, insert order + items), `releaseOrder`, `applyCheckoutSession` (guarded transitions + amount verification).
- [x] Implement the `startCheckout` server action (previous-order release, Checkout Session creation with idempotency key, failure rollback, redirect).
- [x] Wire the `/bag` checkout button and update the tax copy.
- [x] Implement the webhook route (signature verification, `stripe_events` de-duplication, transitions in one transaction, 500 on error).
- [x] Implement `/checkout/success` (server-side session retrieve + `applyCheckoutSession`, status display, `clearBag` on paid).
- [x] Add the `orders:reconcile` script for stale pending/processing orders.
- [x] Add `node:test` tests for pure helpers (transition table, amount check, line clamping).
- [x] Document the Checkout architecture in `CLAUDE.md`.

## Verification

1. `pnpm typecheck && pnpm lint && pnpm build`; `pnpm exec tsx --test src/lib/orders.test.ts`.
2. Local webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` (put the printed `whsec_…` in `.env`), then `pnpm dev`.
3. **Happy path:** add 2 pieces, check out with `4242 4242 4242 4242`. Expect the order `pending` → `paid` and `product_stock` down by the purchased quantities exactly once; `/checkout/success` shows "Thank you"; the bag empties and the header count updates.
4. **Client price tampering:** edit the bag cookie quantities above stock or to unknown IDs. Charged quantities are clamped, unknown IDs are dropped, and the Stripe amount equals the DB prices. There's no price input anywhere to tamper with.
5. **Duplicate events:** `stripe events resend <evt_id>` for a `checkout.session.completed`. Expect a 200, no second state change, and the stock unchanged.
6. **Abandonment:** start a checkout and leave it. Stock drops (reserved); `stripe trigger checkout.session.expired` (or `stripe checkout sessions expire cs_…`) → order `expired`, stock restored. Starting a second checkout from the same browser releases the first reservation immediately.
7. **Failures:** a declined card (`4000 0000 0000 0002`) keeps the order `pending`. An async failure (a test bank-debit method that fails) → `failed`, stock restored.
8. **Oversell race:** with stock = 1, start checkout in two browsers. The second gets the "sold out" path (stock row locked, quantity clamped to 0).
9. **Forged webhook:** `curl -X POST` an unsigned body to the webhook route → 400, no DB change.
10. **Success page without payment:** open `/checkout/success?session_id=cs_test_fake` → no order is marked paid (the Stripe retrieve fails or doesn't match).
11. In the DB (`pnpm db:studio`): `stripe_events` has one row per event id, and `paid_at`/`stock_released_at` are never both set.

## Decisions & trade-offs

- **Inline `price_data` instead of synced Stripe Prices:** one price source (Postgres), no sync job. The trade-off is that the Stripe Dashboard has no product catalog.
- **Reserve stock at session creation:** prevents selling the last piece twice. The trade-off is that stock briefly appears lower for up to 30 min per abandoned checkout, which is mitigated by releasing the previous reservation on a new attempt.
- **Order created before the Stripe session:** gives a stable `orderId` for metadata and the idempotency key, and every payment maps to an order. A failed session creation marks the order `failed` and releases stock.
- **Webhook as the guaranteed path, plus a success-page retrieve:** the customer sees confirmation even if the webhook lags. Both go through the same idempotent, guarded transitions.
- **Event ledger and status guards:** the ledger catches exact replays, and the guards cover different events reaching the same state, so neither is relied on alone.
- **Guest checkout:** `user_id` is nullable, and the email comes from Stripe. Guest orders aren't linked to accounts later.
- **No tax:** `automatic_tax` stays off until a Stripe Tax registration exists, to avoid silently collecting nothing.

## Alternatives considered

- Decrement stock in the webhook: rejected because of overselling plus forced refunds for scarce pieces.
- Embedded Payment Element / custom PaymentIntents: more UI work for no benefit here, so hosted Checkout was chosen.
- Requiring sign-in to check out: adds friction, and the bag already supports guests.
- Trusting `?session_id` or a "paid" query param on the success page: never done; the page always retrieves from Stripe.

## Out of scope

- Refunds and disputes (`charge.refunded`, `charge.dispute.*`), which would be handled later as new transitions.
- Order history in `/account` and an admin orders view.
- Stripe Tax, shipping rates, discounts and promo codes.
- Order confirmation emails.
- Linking guest orders to accounts created later.
- Product variants (stock stays per product).

## Changes

- **2026-10-06, database step:** implemented as planned in `drizzle/0003_orders.sql`. Additions beyond the column list above, which tighten the model without changing it:
  - Check constraints `orders_currency_check` (lowercase ISO code), `orders_paid_at_check` (a `paid` order must have `paid_at`) and `orders_paid_or_released_check` (`paid_at` and `stock_released_at` are never both set; this enforces verification item 11 in the database).
  - An `order_items_product_id_idx` index for the `on delete set null` foreign key.
  - The `timestamps` helper moved from `catalog-schema.ts` to `src/db/columns.ts` so `order-schema.ts` can reuse it. Generated SQL for existing tables is unchanged.
- **2026-10-06, checkout implementation:** all steps done. Deviations from the plan:
  - **Cancel releases stock immediately.** `cancel_url` is `/checkout/cancel?order=<id>`, a route handler that expires the Stripe session and returns the stock when the `atelier_checkout` cookie matches, then redirects to `/bag?checkout=cancelled`. The plan sent cancel straight to `/bag` and waited for expiry. The change was needed because otherwise the shopper's own reserved pieces show as sold out on `/bag`.
  - **Earlier checkout asks Stripe first.** Releasing a previous checkout calls `sessions.expire` before releasing stock, and applies whatever Stripe returns. If that session was paid in the meantime, the order becomes paid instead of being released.
  - **Pure logic split out.** Helpers live in client-safe `src/lib/checkout.ts` (tested in `src/lib/checkout.test.ts`, not `orders.test.ts`).
  - **Bag clearing moved and guarded.** The bag is cleared by `completeCheckout(orderId)` in `src/app/checkout/actions.ts` rather than a `clearBag` in `bag/actions.ts`. It only clears when the checkout cookie matches a `paid` order.
  - **Smaller details.**
    - Session expiry is 31 minutes, to absorb clock skew against Stripe's 30-minute minimum.
    - Orders below Stripe's 50¢ minimum are refused.
    - A payment that arrives for an already-released order is set to `needs_review`.
    - Shipping is limited to the US (`SHIPPING_COUNTRIES` in `orders.ts`).
  - **New dependency.** Added `server-only` as an explicit dependency (recommended by the Next docs) so tsx scripts resolve it with `--conditions=react-server`.
