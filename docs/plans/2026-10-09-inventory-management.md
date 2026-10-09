# Admin inventory management

- **Date:** 2026-10-09
- **Branch:** `feat/admin-inventory`
- **Goal:** Let admins see current stock and change it safely by adding or removing units as well as setting a total, while keeping the admin's figures consistent with what customers see. This reuses the existing database and admin patterns.
- **Status:** done
- **Approval:** confirmed via /save-plan

## Context

Most of this already exists:
- `/admin/stock` and the stock panel on each product page show available stock and the units in open checkouts.
- An admin can set an absolute quantity, but only if stock still holds the value the form showed.

This plan fills the remaining gaps:
- **No add or remove.** Restocking "+12" means retyping a total, which conflicts whenever a checkout lands in between.
- **Admin and storefront disagree on status.** Admin shows a "sold out" count but no "low stock" state, so it doesn't match what customers see.
- **Some units are invisible.** Units held by `needs_review` orders appear nowhere.
- **Typed values get lost.** After a validation error, or a checkout between two saves, the admin loses what they typed or hits needless conflicts.

**No schema change.** `product_stock.quantity` stays the only counter, and it keeps meaning *available* stock.

## Steps

Build in this order, with tests at each step.

- [x] **`src/lib/admin-forms.ts`:** add `parseAdjustStockForm` and `AdjustStockInput`; stock form state also carries `values`.
- [x] **`src/lib/admin-catalog.ts`:** add `adjustStock(productId, delta)`; `getStockOverview` adds `held` (units in unreleased `needs_review` orders).
- [x] **`src/app/admin/stock/actions.ts`:** add `adjustStockAction`; `updateStockAction` returns `values` on error and also revalidates on a conflict.
- [x] **`src/components/admin/stock-form.tsx`:** use the `available` prop as expected, not the stale `state.quantity`; keep the typed value after an error.
- [x] **`src/components/admin/adjust-stock-form.tsx`** (new): an amount field with **Add** and **Remove** buttons.
- [x] **`src/app/admin/stock/page.tsx`:** add a status column (In stock / Low / Sold out), a "Held for review" column and the adjust form; the header shows sold-out and low-stock counts.
- [x] **`src/app/admin/products/[productId]/page.tsx`:** the stock panel gets the adjust form and the held count.
- [x] **`docs/plans/2026-10-09-inventory-management.md`, `CLAUDE.md` (Admin → Stock):** this design and its Tests section, plus the new rule for adjustments.

### Validation rules

All of these live in `admin-forms.ts`, are pure, and are re-checked on the server.

- **`productId`:** a positive integer. Anything else means a tampered form ("This product no longer exists"), not a field error.
- **Set stock** (unchanged):
  - `quantity` is a whole number from 0 to `MAX_STOCK_QUANTITY` (100,000).
  - The hidden `expected` is an integer ≥ 0; anything else means a tampered form.
- **Adjust stock:**
  - `direction` must be `add` or `remove`; anything else means a tampered form.
  - `amount` is a whole number from 1 to 100,000, parsed with `toInt`/`boundedInt`, never `parseFloat`. 0, negatives, decimals and blank input are field errors.
  - The **result** must stay within 0–100,000. The database enforces this in the same statement. If it would go out of range, the admin sees "Only N available to remove" or "Stock can't exceed 100,000", along with the current value.
- **Never trusted from the client:** current stock, reserved, held, or the resulting quantity.

### Server-side update flow

**Adjust** (`adjustStockAction`):
1. `await requireAdmin()` as the first statement (enforced by `guards.test.ts`).
2. `parseAdjustStockForm`. On failure, return `{ok:false, message, fieldErrors, values}`.
3. `adjustStock(productId, ±amount)` runs in one transaction:
   1. Check the product exists, else return `not_found`.
   2. `INSERT product_stock (product_id, 0) ON CONFLICT DO NOTHING`, because old products may have no stock row.
   3. `UPDATE product_stock SET quantity = quantity + $delta WHERE product_id = $id AND quantity + $delta BETWEEN 0 AND 100000 RETURNING quantity`.
   4. If no row comes back, read the current value and return `out_of_range` with it.
4. `revalidatePath("/", "layout")`, then return `{ok:true, message:"Added 12 units. 30 available."}`.

Why the relative update is safe:
- The `UPDATE` takes the row lock itself, so it waits for a checkout's lock and then applies on top of it. No update is lost, and no `expected` is needed.
- It touches only one row, so lock ordering can't cause a deadlock.
- `CHECK (quantity >= 0)` is a second safety net.

**Set** (`updateStockAction`):
- Keeps its `expected` check. It's the tool for "I counted the shelf, the number is N".
- A conflict now also revalidates, so the page re-renders with the current value. The forms can then rely on the `available` prop, which removes the stale-expected friction.
- Before relying on this, confirm in `node_modules/next/dist/docs/` that `revalidatePath` inside an action refreshes the current admin page.

### How customer-facing availability stays consistent

- **One source of truth.** Admin writes the same `product_stock.quantity` that `getProductBySlug`, `getBagProducts` and `reserveOrder` read. There's no second copy of stock to keep in sync.
- **Pages refresh immediately.** Every write, and every conflict, calls `revalidatePath("/", "layout")`. Without it, product and collection pages (`revalidate = 60`) could be up to 60 s stale.
- **A stale page still can't oversell:**
  - Bag actions clamp quantities to live stock.
  - `/bag` shows `min(quantity, stock)`.
  - Checkout re-checks stock and reserves it under row locks.
- **Open checkouts are unaffected.** Their units are already deducted. If they expire, the units come back as a relative `+n`, which combines correctly with admin adjustments.
- **Status labels match the storefront.** The admin status column uses the storefront's `getStockStatus()` (`lib/catalog.ts`), so "Low" and "Sold out" mean exactly what customers see.
- **Held units are read-only.** `needs_review` units are shown so the numbers add up, but they can't be edited. They stay deducted until the order is resolved.

## Tests

Every test lands in the same PR, at the cheapest layer that can catch the problem.

- **Unit** (`tests/unit/lib/admin-forms.test.ts`): `parseAdjustStockForm` with valid input, then 0, a negative, a decimal, over the limit, blank, a forged `direction` and a forged `productId`.
- **Integration** (`tests/integration/lib/admin-catalog.test.ts`):
  - add and remove
  - a product with no stock row
  - removing below 0, or adding above 100,000, is refused and returns the current value
  - an unknown product
  - `held` counts only unreleased `needs_review` orders
  - **Races:** an adjust running at the same time as `reserveOrder`, and two adjusts at the same time (`Promise.all`, as in `reservation.test.ts`). The final quantity must equal the start plus every change.
- **Integration** (`tests/integration/app/admin/stock/actions.test.ts`):
  - `expectAdminOnly` (a visitor is redirected to sign-in, a customer gets a 404)
  - revalidation
  - tampered forms
  - `values` returned on errors
  - a conflict on set now revalidates
- **Component:**
  - `tests/unit/components/admin/adjust-stock-form.test.tsx`: field errors, keeping the typed input, the pending state.
  - `tests/unit/components/admin/stock-form.test.tsx`: the expected value follows the prop.
- **Integration** (`tests/integration/app/admin/pages.test.ts`), added during implementation: the stock page shows the storefront statuses, the sold-out/low summary and the adjust form; the product stock panel shows units held for review.
- **E2E** (`tests/e2e/admin.spec.ts`), one added step: remove stock until the product page shows "Sold out", then add stock and see it back in stock.
- **Break-the-guard check:** remove the `BETWEEN` guard, then the `requireAdmin()` call, one at a time. Confirm the tests fail each time, then restore.
- **Before the PR:** `pnpm typecheck && pnpm lint && pnpm test:all && pnpm test:e2e`. Then check `/admin/stock` and a product's stock panel by hand in `pnpm dev`, at desktop and phone widths.

## Decisions & trade-offs

- **Keep the existing stock field.** `product_stock.quantity` stays the single counter of available stock. No migration, no second counter that could drift.
- **Use relative adjustments for add and remove.** They combine safely with concurrent checkouts under the row lock, so they need no `expected` value and can't lose an update.
- **Keep absolute set with its `expected` check.** It's for stock counts. Conflicts now revalidate, so the forms always start from the live value.
- **Enforce bounds in SQL, in the same statement.** The `BETWEEN 0 AND 100000` guard sits in the `UPDATE` itself, so no check-then-write race is possible.
- **Reuse the storefront's `getStockStatus()`** so admin and customer labels can't diverge.
- **Show held units but don't make them editable.** This makes the numbers add up without changing order handling.

## Alternatives considered

- **Append-only `stock_movements` history table, with every change logged (including checkout reserves and releases).** Chosen during the investigation, then dropped for this version: the request asked to keep inventory simple and keep using the existing stock field. It can be added later without changing this design.
- **A signed amount input (`-2`, `+5`).** Not chosen: separate Add and Remove buttons with a positive amount avoid sign mistakes.

## Out of scope

- A stock history or audit log (see Alternatives)
- Per-product low-stock thresholds (the storefront's `getStockStatus` threshold stays)
- Bulk or CSV receiving
- Filters and search on `/admin/stock`
- Variants, SKUs and warehouses
- Changing `db:seed` stock behavior

## Changes

- **2026-10-10:** implemented. Small additions beyond the written plan:
  - A refused adjustment (`out_of_range`) also revalidates, like a refused set, so the page shows the live value.
  - Added a render test in `tests/integration/app/admin/pages.test.ts` for the new columns, summary and held count (listed under Tests).
  - The E2E journey now sells out with **Remove**, restocks with **Add**, and uses **Set** on `/admin/stock`, instead of selling out with Set on the product page.
