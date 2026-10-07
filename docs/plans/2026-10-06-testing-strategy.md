# Testing strategy: feature-by-feature test coverage

- **Date:** 2026-10-06
- **Branch:** main
- **Goal:** Build a test foundation (Vitest unit/integration/component and Playwright E2E), then add coverage one feature at a time, highest-risk areas first.
- **Status:** in-progress (Phase 0 merged; Phase 1 on branch `test/phase-1-pure-helpers`)
- **Approval:** approved in plan mode

## Context
The store already has a catalog, bag, auth, Stripe checkout, webhooks, reconciliation and order history, but only two test files exist: `src/lib/bag.test.ts` and `src/lib/checkout.test.ts`. Both cover pure helpers only. The risky code, meaning stock reservation, order state changes, webhook handling, access control and server-action validation, has no tests. Before adding features, we want a test foundation and then coverage added one feature at a time, starting with the highest-risk areas. Decisions taken: **Vitest** as the runner (the 2 existing files migrate to it) and **Playwright** for a small E2E layer at the end.

## Test layers
| Layer | Tool | File pattern | What it covers |
|---|---|---|---|
| Unit | Vitest (node env) | `tests/unit/**/*.test.ts` | Pure helpers in client-safe modules (`bag.ts`, `checkout.ts`, `catalog.ts`, `redirects.ts`) |
| Integration | Vitest + real Postgres test DB | `tests/integration/**/*.test.ts` | `lib/products.ts`, `lib/orders.ts`, `lib/bag-server.ts`, server actions, route handlers, `proxy.ts`, `session.ts`, Better Auth |
| Component | Vitest + jsdom + Testing Library | `tests/unit/**/*.test.tsx` | Only client components that contain logic |
| E2E | Playwright | `tests/e2e/*.spec.ts` | A few critical browser flows against a built app |

Principles:
- Use a real Postgres for anything that touches `@/db`; don't mock Drizzle. Row locks, check constraints and `on conflict` behaviour are the things worth testing.
- Mock only at system boundaries: `next/headers` (an in-memory cookie store), `@/lib/stripe` (a stub `getStripe()`), and `auth.api.getSession` where a session is needed.
- Webhook signatures use the real `stripe.webhooks.generateTestHeaderString`, so no network is needed.
- Test through public functions and exported actions or handlers, not private helpers.

## Steps

### Phase 0: Foundation
- [x] Add dev dependencies: `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/dom`, `jsdom`, `@playwright/test`. Add any that need build scripts to `allowBuilds` in `pnpm-workspace.yaml`.
- [x] Add `vitest.config.ts` with three `projects`: `unit` (node, `*.test.ts`), `integration` (node, `*.int.test.ts`, `fileParallelism: false`, globalSetup + setupFiles) and `component` (jsdom, `*.test.tsx`). Resolve the `@/*` alias from tsconfig and alias `server-only` to an empty module.
- [x] Add scripts: `test` (unit + component), `test:int`, `test:all`, `test:watch`, `test:coverage`, `test:e2e`.
- [x] Migrate `src/lib/bag.test.ts` and `src/lib/checkout.test.ts` to Vitest by swapping the `node:test` import for `vitest` (the `node:assert/strict` assertions can stay), and update the "Run with" comments.
- [x] Set up the test DB: create an `atelier_test` database, add `.env.test` (with an `.env.test.example` template) containing `DATABASE_URL`, a dummy `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BETTER_AUTH_SECRET` and the app URLs. The globalSetup refuses to run unless the DB name ends in `_test`, then applies `./drizzle` migrations with the drizzle-orm migrator.
- [x] Add test helpers under `src/test/`:
  - `db.ts`: `resetDb()`, which truncates all tables with restart identity cascade, plus closing the pool after the run.
  - `factories.ts`: `createCategory`, `createProduct({ priceCents, stock })`, `createUser`, `createOrder({ status, … })`.
  - `next-headers.ts`: an in-memory `cookies()` mock with get/set/delete that records the options passed to `set`.
  - `stripe.ts`: a `getStripe()` stub with `checkout.sessions.create/retrieve/expire` as `vi.fn`, a real `webhooks`, and `makeCheckoutSession(overrides)` / `makeEvent(type, session)` builders.
  - `navigation.ts`: helpers to assert `redirect()` / `notFound()` calls.
- [x] Add a "Testing" section to `CLAUDE.md` covering the layers, commands, the test DB, the mock boundaries, and the rule that new features ship with tests.

### Phase 1: Pure helpers (unit)
- [x] `redirects.ts`, `safeNext`: same-origin paths pass; `//evil.com`, `/\evil.com`, absolute URLs and non-strings fall back.
- [x] `catalog.ts`: `formatPrice` (cents, no fractional digits) and `getStockStatus` boundaries (0, 1, 3, 4, negative).
- [x] `checkout.ts` gaps: `checkoutTotalCents`, `orderReference`, `formatOrderDate` in `STORE_TIME_ZONE` (around midnight UTC), `orderStatusLabels` completeness, and the `MIN_CHARGE_CENTS` constant behaviour.

### Phase 2: Catalog reads (integration, `lib/products.ts`)
- [ ] `searchProducts`: case-insensitive matching on name, category and description; name matches rank first; `%` and `_` match literally; respects `limit`.
- [ ] `getBagProducts`: returns nothing for an empty list, omits missing IDs, and uses stock 0 when there's no `product_stock` row.
- [ ] `getProduct` (unknown slug → undefined, includes stock), `getRelatedProducts` (same category first, excludes the product itself), `getCategory`, `getCategoryProducts`, `getNewArrivals`, `getGiftEdit` and `getHomeCategories` (ordering and null-image filtering).

### Phase 3: Bag (integration, cookie mock + DB)
- [ ] `bag-server.ts`: `writeBag` deletes the cookie when the bag is empty and otherwise sets the options (non-httpOnly, 30 days); `getBag` drops deleted products, clamps to `min(quantity, stock)` and keeps `requested`.
- [ ] `addToBag`: rejects invalid IDs (string, float, negative, object), unknown and sold-out products; increments existing lines; fixes up a stale cookie above stock; enforces `MAX_BAG_LINES`.
- [ ] `updateBagQuantity`: 0 removes the line; clamps to stock with an "Only N available" message; a sold-out product is removed; an invalid quantity or missing line is rejected.
- [ ] `removeFromBag`: removes the line, and invalid input leaves the cookie unchanged.

### Phase 4: Checkout and orders (integration, highest risk)
- [ ] `reserveOrder`: decrements stock, snapshots names and prices, ignores client-side prices; handles `empty` and `below_minimum`; **concurrency**: two parallel reservations for a product with stock 1 produce exactly one order.
- [ ] `releaseOrder`: returns stock exactly once (a second call is a no-op), skips items whose product was deleted, and only acts on `pending`/`processing`.
- [ ] `applyCheckoutSession`: covers each transition's writes (`paid` sets `paidAt`, payment intent, email coalesce and shipping; `processing`; `release`; `needs_review`), plus `unknown_order` and `session_mismatch`. The DB check constraints stay satisfied.
- [ ] `processStripeEvent`: ignores non-checkout events; a duplicate event ID returns `duplicate`; an error inside the transaction leaves no `stripe_events` row.
- [ ] Stripe-backed functions (stubbed): `createCheckoutSession` (payload built from DB lines, idempotency key, session ID stored), `abandonCheckout` (no session → failed; `expire` throws → `retrieve` and apply), `syncCheckoutSession` (invalid ID or `StripeInvalidRequestError` → null), `getOpenCheckout` (only open, unexpired sessions; works when Stripe is unreachable).
- [ ] `startCheckout` action: empty bag; abandons the previous checkout from the cookie; reservation errors; a Stripe create failure → `failOrder` and stock restored; success sets the httpOnly checkout cookie and redirects. `completeCheckout`: only clears the bag when the cookie matches a `paid` order.
- [ ] Webhook `POST` route: missing secret → 500, missing or invalid signature → 400 with no DB change, a valid signed event → applied, a processing error → 500.
- [ ] Cancel `GET` route: cookie mismatch → bag, paid in another tab → success page, normal cancel → stock released and cookie deleted.
- [ ] `getStaleOrders` age cut-off (backdate `createdAt`) and the reconcile flow (no session → released).

### Phase 5: Auth and access control (integration)
- [ ] `proxy.ts`: redirects to `/sign-in?next=<path+search>` without a session cookie and passes through with one (build a `NextRequest` directly).
- [ ] `session.ts` (with `auth.api.getSession` mocked): `requireSession` redirects with an encoded `next`; `requireAdmin` redirects anonymous users, calls `notFound()` for customers, and passes admins with `disableCookieCache`.
- [ ] Better Auth against the test DB: sign up and sign in via `auth.api`; `role` defaults to `customer` and can't be set through sign-up input; the `make-admin` logic grants admin.

### Phase 6: Order history (integration)
- [ ] `getCustomerOrders`: scoped to the user, placed orders only (excludes `pending`, `expired`, and `failed` without a payment intent), newest first, respects `limit`.
- [ ] `getCustomerOrder`: another user's order, an invalid ID or a non-placed order → undefined; items include product slug and image, and a deleted product still shows its snapshot.

### Phase 7: Client components with logic (component)
- [ ] `BagLink` (count from the cookie, updates on the `bag-change` event), `useBagAction` (dispatches the event), `QuantityStepper` bounds, `AuthForm` (errors and `safeNext` redirect), `PaymentStatusPoller` (stops on a final status, using fake timers).

### Phase 8: E2E (Playwright)
- [ ] `playwright.config.ts`: `webServer` runs build + start against the test DB (seeded with `db:seed`), Chromium only to start.
- [ ] Flows: browse → product → add to bag → header count → change quantity → remove; sign up → account → sign out; `/account` and `/admin` redirect when signed out, and `/admin` 404s for a customer; checkout start redirects to `checkout.stripe.com` and a signed webhook marks the order paid, after which it appears in order history. This flow runs only when a sandbox `STRIPE_SECRET_KEY` is present and is skipped otherwise.

### Phase 9: CI
- [ ] GitHub Actions workflow: a Postgres service, `pnpm install`, then lint, typecheck, `test`, `test:int`; a separate E2E job (with Playwright browsers cached).

## Working rhythm for each phase
1. Write the tests for that feature, then run them.
2. If a test shows a real bug, fix it in its own commit with the test as the regression guard, and list it in the PR.
3. Use one branch/PR per phase (or per pair of small phases), and tick the steps in the saved plan.

## Decisions & trade-offs
- **Vitest over `node:test`**: built-in `vi.mock` for `next/headers`, `server-only` and Stripe, `@/` alias resolution, setup files and watch mode, for the cost of one dev dependency. Migrating the existing files is a one-line import change.
- **Real Postgres over a mocked DB**: the riskiest logic (row locks, check constraints, `on conflict`, SQL scoping by `user_id`) lives in SQL. The trade-off is that integration tests need a local `atelier_test` DB and run serially.
- **Stripe stubbed, signatures real**: no network or flakiness in unit and integration tests. Only the optional E2E checkout talks to the Stripe sandbox.
- **Order by risk**: money, stock and access control (Phases 3–5) come right after the cheap foundation, ahead of UI.

## Alternatives considered
- **Stay on `node:test` + tsx:** no new dependency, but mocking `next/headers`, `server-only` and Stripe would need Node's experimental `mock.module` flag and a custom loader for `@/`. Rejected as too awkward for the integration layers.
- **Unit + integration only (no E2E):** rejected in favour of a small Playwright layer for critical browser flows.
- **Mocking Drizzle/the DB:** rejected, because the riskiest logic (locks, constraints, SQL scoping) only shows up against a real Postgres.

## Out of scope
- Visual regression and screenshot tests.
- Load or performance testing.
- Testing presentational components (home, product cards, UI primitives) and `auth-schema.ts` (it's generated).
- Completing Stripe's hosted payment page inside E2E.

## Verification
- `pnpm test` and `pnpm test:int` pass locally against `atelier_test`; `pnpm test:coverage` reports coverage for `src/lib` and `src/app/**/actions.ts` / `route.ts`.
- Sanity-check a couple of tests by breaking the code on purpose (e.g. remove the `stock_released_at` guard in `releaseOrder`, or the `user_id` filter in `getCustomerOrder`) and confirm they fail.
- `pnpm test:e2e` passes, with the Stripe flow skipped when no sandbox key is set.
- The CI workflow is green on the PR.

## Changes
- **2026-10-06, Phase 0 implementation** (branch `test/phase-0-foundation`):
  - The config is `vitest.config.mts`, not `.ts`, because Vite 8 warns about ESM config files loaded as CommonJS. It parses `.env.test` itself, since it can't import `src/test/env.ts` without the same warning.
  - Installed Vitest 5.0.3, @vitest/coverage-v8 5.0.3, Testing Library (react 16, dom 10), jsdom 30 and @playwright/test 1.63. `@types/node` went from `^20` to `^22` to match Node 22 and Vitest's peer range. No package needed `allowBuilds`.
  - The test DB is done and verified (create-if-missing database, migrations, the `_test` guard, 31 tests passing on 2026-10-07). The `.env.test.example` template still has to be added by hand, because Claude isn't allowed to write `.env*` files. Its contents are in the PR description.
  - Added harness smoke tests not listed in the plan: `src/test/foundation.int.test.ts` (DB reset, factories, cookie, Stripe and navigation helpers) and `src/test/foundation.test.tsx` (jsdom + Testing Library).
  - Extra helpers: `signedWebhookRequest()` and `invalidRequestError()` in `src/test/stripe.ts`, and `src/test/env.ts` (env loading and the `_test` guard).
  - `.gitignore`: allows `.env.test.example` and ignores Playwright output folders.
- **2026-10-07, test env:** `.env.test` only needs `DATABASE_URL`, and the shell value wins when set (CI). `vitest.config.mts` always forces dummy `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`, overriding `.env.test` and the shell. A foundation test asserts this, after it caught real keys coming from a `.env.test` copied from `.env`.
- **2026-10-07, test layout:** tests moved from next to their source into a top-level `tests/` folder, organized by scope. `tests/unit/` holds `*.test.ts` (unit project) and `*.test.tsx` (component project); `tests/integration/` and `tests/e2e/` hold the other scopes; helpers are in `tests/helpers/` (was `src/test/`). Inside each scope, paths mirror `src/`. The `.int.test.ts` suffix is gone because the folder sets the scope. Tests import helpers through a new `@tests/*` tsconfig alias. Earlier entries keep their original paths.
- **2026-10-07, Phase 1** (branch `test/phase-1-pure-helpers`): tests in `tests/unit/lib/` for `redirects.test.ts`, `catalog.test.ts` and the `checkout.test.ts` gaps.
  - **Bug found and fixed: open redirect in `safeNext`.** `/sign-in?next=/%09/evil.com` passed the check because the value starts with `/` and its second character is a tab. Browsers strip tabs and newlines when parsing URLs, so `window.location.assign` in `AuthForm` went to `https://evil.com/` after sign-in. `safeNext` now resolves the path with `URL` against a probe origin, rejects anything that leaves it, and returns the normalized path. The new `redirects.test.ts` is the regression test.
  - `formatPrice` rounds to whole dollars (e.g. 1999 → "$20"). Every seeded price is a whole dollar, so this is pinned by a test rather than changed.
  - `MIN_CHARGE_CENTS` is pinned at 50. How `reserveOrder` enforces it is covered in Phase 4.
