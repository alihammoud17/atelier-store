# Admin experience, v1 (catalog, stock, orders)

- **Date:** 2026-10-08
- **Branch:** main
- **Goal:** Give admins a focused area to view, create and edit products, manage categories, view and update stock, and view orders. Every admin page and server action verifies the admin role.
- **Status:** done
- **Approval:** approved in plan mode

## Context

`/admin` exists today only as a placeholder (`src/app/admin/page.tsx`), guarded by `requireAdmin()` in `src/lib/session.ts`. Admins can't manage the catalog: products, categories and stock change only through `pnpm db:seed`. This plan adds a focused admin area to view, create and edit products, manage categories, view and update stock, and view orders. Every admin page and server action verifies the admin role. There are no dashboards, analytics, warehouses or new roles. The plan reuses the existing schema (no migration), `requireAdmin()`, the server-only data-module pattern, the server actions validation style from `app/bag/actions.ts`, and the design-system components.

## Routes (all under `src/app/admin/`, all `robots: { index: false }`)

| Route | Purpose |
|---|---|
| `/admin` | Replace the placeholder with a short index of links to the sections below (no metrics) |
| `/admin/products` | Table: image, name, category, price, stock, updated. Links to edit and to "New product" |
| `/admin/products/new` | Create form |
| `/admin/products/[productId]` | Edit form + stock panel for that product |
| `/admin/categories` | List with product counts, plus an inline create form |
| `/admin/categories/[categoryId]` | Edit form + delete (only when it has no products) |
| `/admin/stock` | All products: available, reserved (open checkouts), with a quantity form per row |
| `/admin/orders` | Placed orders, newest first, with an optional `?status=` filter (validated against the enum) |
| `/admin/orders/[orderId]` | Read-only detail: items, totals, customer email, shipping, Stripe IDs, timestamps |

- `admin/layout.tsx`: section nav (Products · Categories · Stock · Orders) + sign out. It calls `requireAdmin()` too, but **every page still calls it itself** (as CLAUDE.md requires, layouts aren't enough).
- Admin pages read the session, so they're dynamic. No `revalidate` export is needed.
- `[productId]`/`[categoryId]`/`[orderId]` params are validated (positive int / `isOrderId`). A bad param means `notFound()`.

## Data layer

- **New `src/lib/admin-catalog.ts`** (`server-only`): admin reads and writes for products, categories and stock. Same shape as `lib/products.ts`, so it imports `@/db`.
  - Reads: `getAdminProducts()`, `getAdminProduct(id)` (with stock), `getAdminCategories()` (with product counts), `getAdminCategory(id)`, `getStockOverview()` (available from `product_stock` plus reserved = sum of `order_items.quantity` for `pending`/`processing` orders with `stock_released_at is null`).
  - Writes: `createProduct(input)` inserts the `products` row **and** its `product_stock` row in one transaction (initial quantity from the form, default 0). `updateProduct(id, input)`, `createCategory`, `updateCategory`, `deleteCategory(id)` (relies on the FK `restrict`, which maps to "category still has products"), and `setStock(productId, { quantity, expected })`.
  - Unique-violation (`23505` on `slug`) maps to a field error, not a 500.
- **`src/lib/orders.ts`** (it owns orders): add `getAdminOrders({ status?, limit })` and `getAdminOrder(orderId)`. Same queries as `getCustomerOrders`/`getCustomerOrder`, but without the `user_id` filter, using the existing `placedOrder` condition by default (abandoned checkouts aren't orders). Selected extra columns: email, `stripePaymentIntentId`, `stripeCheckoutSessionId`, `paidAt`, `stockReleasedAt`.
- **New `src/lib/admin-forms.ts`** (client-safe, pure): `parseProductForm(formData)`, `parseCategoryForm(formData)`, `parseStockForm(formData)` → `{ ok: true, value } | { ok: false, fieldErrors }`. These hold the rules:
  - slug `^[a-z0-9]+(?:-[a-z0-9]+)*$`, max length; name/title/alt required and trimmed with a max length
  - price entered as dollars (`"129"` / `"129.50"`), parsed to **integer cents** with a string regex, never `parseFloat`. Range 0 to a sane max.
  - `imageSrc` must be `https://images.unsplash.com/…`. `next.config.ts` has no `remotePatterns`, so any other host would break `next/image`. Allowing more hosts is out of scope.
  - details: textarea, one per line, empty lines dropped, capped count
  - categoryId / quantity: plain-digit ints, same approach as `toInt` in `app/bag/actions.ts` (extract a shared `toInt` into `src/lib/form-values.ts` and reuse it in both places)
  - quantity 0 … 100 000

## Server actions (`"use server"`, one file per section)

- `app/admin/products/actions.ts`: `createProductAction`, `updateProductAction`
- `app/admin/categories/actions.ts`: `createCategoryAction`, `updateCategoryAction`, `deleteCategoryAction`
- `app/admin/stock/actions.ts`: `updateStockAction` (used by both `/admin/stock` and the product edit page)

Every action follows the same order:
1. `await requireAdmin()` as the **first statement**, before reading any argument.
2. Parse with `admin-forms.ts`. Ids from hidden inputs are re-validated, never trusted.
3. Call `admin-catalog.ts`.
4. `revalidatePath` the affected storefront paths (`/`, `/collections/[slug]` layout, `/products/[slug]` for the old and new slug, `/search`) and the admin list, so storefront ISR pages don't wait up to 60 s.
5. Return `{ ok, message, fieldErrors? }` for `useActionState`, or `redirect()` to the edit page after create.

**Stock update semantics.** `product_stock.quantity` is *available* stock, because checkout already decrements it on reservation and `releaseOrder` adds it back. So the admin sets the **available** quantity. Reserved units are shown alongside, read-only. To avoid a lost update when a checkout reserves stock while the form is open, the form posts the `expected` quantity it displayed. `setStock` does `UPDATE … SET quantity = $new WHERE product_id = $id AND quantity = $expected`. If it matches 0 rows, it returns "Stock changed to N since you loaded this page" with the fresh value, and nothing is written.

## Components (`src/components/admin/`)

Reuse `Button`, `ButtonLink`, `Heading`, `Eyebrow`, `Text`, `TextLink`, `CatalogImage`, `MediaFrame` from `@/components/ui`, `OrderStatusLabel` from `components/account/order-status.tsx`, and `formatPrice`, `orderReference`, `formatOrderDate`, `getStockStatus`.

- `admin-nav.tsx`: section links with active state (client, `usePathname`)
- `product-form.tsx` (client): `useActionState`, shared by new and edit, with field-level errors in the same style as `auth-form.tsx` (`aria-invalid`, `aria-describedby`)
- `category-form.tsx` (client): create and edit
- `delete-category-button.tsx` (client): confirm + action, shows the "has products" error
- `stock-form.tsx` (client): number input + hidden `productId`/`expected`, inline result message
- `admin-table.tsx`: simple hairline table wrapper (server), used by the product, category, stock and order lists
- Order detail reuses the layout of `account/orders/[orderId]/page.tsx`, but stays its own page, with admin-only fields added. It isn't a shared abstraction yet.

All form fields use project tokens only (`border-line`, `text-label`, square corners). Mobile: the tables collapse to stacked rows below `sm`.

## Verification strategy

**Admin-role verification is enforced in three places:**
1. `proxy.ts` (already matches `/admin/:path*`). This is optimistic only.
2. `requireAdmin()` at the top of every admin page **and** every admin action. It bypasses the cookie cache, so revocation applies on the next request. Non-admins get a 404 and visitors are redirected to sign-in.
3. Guard tests that fail if any page or action is added without the check (below).

## Steps


- [x] 1. Extract `toInt` to `src/lib/form-values.ts`. Add `src/lib/admin-forms.ts` with unit tests.
- [x] 2. Add `src/lib/admin-catalog.ts` (reads + writes) and `getAdminOrders`/`getAdminOrder` in `lib/orders.ts`, with integration tests.
- [x] 3. Mock `next/cache` in the integration setup. Add the products, categories and stock actions, with integration tests, including the denied cases.
- [x] 4. Admin layout + nav, and replace the `/admin` index.
- [x] 5. Products pages + `product-form`, with component tests.
- [x] 6. Categories pages + forms.
- [x] 7. Stock page + `stock-form`, with component tests.
- [x] 8. Orders list + detail pages.
- [x] 9. Static guard test + admin pages integration test; break-the-guard check.
- [x] 10. E2E admin journey; update CLAUDE.md with a short "Admin" section (data module, guard rule, stock semantics); full check run.

## Tests


- **Unit** (`pnpm test`)
  - `tests/unit/lib/admin-forms.test.ts`: slug rules, dollars→cents (`"129.5"`→12950; rejects `"1e3"`, `"-1"`, `"12.345"`, `""`, huge values), non-Unsplash and `http:` image URLs rejected, details splitting, quantity bounds, hostile ids (`"0x10"`, `"1.5"`, `"-3"`).
  - `tests/unit/lib/form-values.test.ts`: the extracted `toInt` (bag actions keep their existing tests green).
  - `tests/unit/app/admin/guards.test.ts`: reads every `src/app/admin/**/page.tsx` and asserts it calls `requireAdmin(`. Reads every `src/app/admin/**/actions.ts` and asserts each exported async function's body starts with `await requireAdmin()`. This catches a forgotten guard on a newly added route.
- **Integration** (`pnpm test:int`, real Postgres). `next/cache` gets mocked in `tests/helpers/setup-integration.ts` as a boundary (`revalidatePath` → `vi.fn`, reset per test):
  - `tests/integration/app/admin/products/actions.test.ts`: create inserts product + stock row; edit updates fields and revalidates the old and new slug paths; duplicate slug → field error; unknown category → error; tampered `productId` → error. **Every action is called as a visitor (redirect, nothing written) and as a customer (404, nothing written).**
  - `tests/integration/app/admin/categories/actions.test.ts`: create/edit/duplicate slug; delete succeeds when empty, refuses with products (row kept); visitor/customer denied.
  - `tests/integration/app/admin/stock/actions.test.ts`: sets quantity; stale `expected` → conflict message, no write; negative/over-max rejected; a reserved order (`createReservedOrder`) shows as reserved in `getStockOverview` and releasing it after an admin update yields `admin value + reserved`; visitor/customer denied.
  - `tests/integration/lib/orders/admin.test.ts`: `getAdminOrders` lists placed orders of all customers and guests, excludes pending/expired/failed-without-PI, status filter works and an invalid status is ignored; `getAdminOrder` returns any customer's order and is undefined for an invalid id.
  - Admin pages: `tests/integration/app/admin/pages.test.ts` renders each page's default export as a visitor (`expectRedirect`) and customer (`expectNotFound`), and for an admin checks it resolves. This complements the static guard test.
  - Break-the-guard check (per CLAUDE.md): temporarily remove `requireAdmin()` from one action, confirm the denied tests fail, restore.
- **Component** (`pnpm test`)
  - `tests/unit/components/admin/product-form.test.tsx`: shows field errors returned by the action, preserves entered values, disables submit while pending.
  - `tests/unit/components/admin/stock-form.test.tsx`: shows the conflict message and updates the displayed `expected` value to the fresh quantity.
- **E2E** (`pnpm test:e2e`, extend `tests/e2e/auth.spec.ts` or add one `admin.spec.ts`)
  - One journey: an admin (granted through the DB in the spec setup) creates a category, creates a product in it with stock 2, sees it on `/products/<slug>` with price and stock, edits the price and sees it update on the storefront, sets stock to 0 and sees "sold out", then opens `/admin/orders`.
  - Keep the existing "customers get a 404 from the admin area" test and extend it to `/admin/products`.

Before the PR: `pnpm typecheck && pnpm lint && pnpm test:all && pnpm test:e2e`, then manually run `pnpm dev`, run `pnpm auth:make-admin <email>`, and walk through each route on desktop and phone width.

- **Added during implementation** (see Changes):
  - `tests/integration/lib/admin-catalog.test.ts` (integration): reads, writes, slug and category errors, delete restrictions, `setStock` conflicts and missing stock rows, reserved stock in `getStockOverview`, and an admin update followed by a release.
  - `tests/helpers/next-cache.ts` (the `next/cache` boundary mock) and `tests/helpers/admin.ts` (`expectAdminOnly`, `formData`).
  - The pages integration test also renders every page for an admin, checks that an admin sees other customers' orders, checks the 404 for unknown and malformed IDs, and checks that an unknown `?status=` is ignored.
  - The E2E journey also covers a validation error that keeps the typed values, including the selected category. The customer-404 E2E test covers `/admin/products` and `/admin/orders`.

**Run on 2026-10-09:** `pnpm typecheck`, `pnpm lint`, `pnpm test:all` (37 files, 494 tests) and `pnpm test:e2e` (12 tests) all passed. Break-the-guard check: removing `requireAdmin()` from `updateStockAction` and `/admin/orders` failed the static guard tests, the action denial test and the page denial tests. The guards were restored, and screenshots were reviewed at 1366 px and 390 px.

## Decisions & trade-offs

- **No migration.** The existing `categories`, `products`, `product_stock` and `orders` tables cover v1. Reuse `requireAdmin()` (bypasses the cookie cache, 404s for non-admins) instead of a new role system.
- **Separate `lib/admin-catalog.ts`** (server-only) for admin reads/writes, so `lib/products.ts` stays storefront-only. Admin order reads go in `lib/orders.ts`, which owns orders.
- **Pure validation in `lib/admin-forms.ts`** (client-safe, unit-testable). No new validation dependency, matching the hand-written `toInt` style of `app/bag/actions.ts`, which is extracted into `lib/form-values.ts` and shared.
- **Money stays integer cents.** Dollar input is parsed by regex, never `parseFloat`.
- **Unsplash-only image URLs.** `next.config.ts` has no `remotePatterns`, so other hosts would break `next/image`.
- **Admin sets *available* stock**, because checkout already decrements on reservation and `releaseOrder` adds it back. Reserved units are shown read-only. An optimistic `expected` check prevents lost updates against concurrent checkouts.
- **`revalidatePath` after every write**, so storefront ISR pages (`revalidate = 60`) reflect admin changes immediately.
- **Admin guard is checked in three places:** the optimistic proxy, `requireAdmin()` at the top of every page and action, and guard tests that fail when a new page or action omits it.
- **Admin order list uses `placedOrder`**: abandoned or open checkouts aren't shown as orders, consistent with customer history.

## Alternatives considered

- **Stock as a delta ("receive +N") instead of setting a quantity.** Rejected for v1 because setting the shown number is simpler for admins, and the `expected` check gives the same safety against concurrent changes.
- **Sharing the order-detail component between account and admin.** Deferred: admin adds different fields, and an abstraction isn't justified yet.
- **Relying on `admin/layout.tsx` for the guard.** Rejected: CLAUDE.md requires the check in every page and action, because layouts aren't a security boundary.

## Out of scope

Dashboards and analytics, product deletion (order history would keep only snapshots), image upload (Unsplash URLs only), variants, warehouses or multi-location stock, a stock movement log, order fulfilment, refunds or status changes, admin user management (keep using `pnpm auth:make-admin`), and roles beyond `customer`/`admin`.

## Changes

**2026-10-09: implementation notes**
- **Revalidation:** every admin write calls `revalidatePath("/", "layout")` instead of listing individual paths. Product names, prices, stock and categories also appear in "related products", the home grid and search. The catalog is small, so refreshing the whole storefront is simpler and never misses a page.
- **Category delete:** Postgres reports an `on delete restrict` violation as `23001` (restrict_violation), not `23503`. The integration test caught this, and `deleteCategory` now handles both codes.
- **Form state:** admin actions return the submitted `values` with their errors, because React resets a form after its action. A `<select>` only applies `defaultValue` on mount, so the category select is keyed on the returned value. Without that, a failed submit would clear the chosen category. The component test caught this.
- **Stock form:** `parseStockForm` treats a malformed `productId` or `expected` as a tampered form (`invalid`), not a field error.
- **Extra components:** `form-fields.tsx` (labelled inputs, textareas, selects and the result message, in the auth-form style), `admin-page-header.tsx`, and a `ChevronDownIcon` in `components/ui/icons.tsx` for the select.
- **Shared helpers:** `toPositiveInt` was extracted with `toInt` into `lib/form-values.ts`.
