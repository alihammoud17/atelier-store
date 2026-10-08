# Testing strategy: feature-by-feature test coverage

- **Date:** 2026-10-06
- **Branch:** main
- **Goal:** Build a test foundation (Vitest unit/integration/component and Playwright E2E), then add coverage one feature at a time, highest-risk areas first.
- **Status:** in-progress (Phases 0–7 merged; Phase 8 on branch `test/phase-8-e2e`; next: Phase 9)
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
- [x] `searchProducts`: case-insensitive matching on name, category and description; name matches rank first; `%` and `_` match literally; respects `limit`.
- [x] `getBagProducts`: returns nothing for an empty list, omits missing IDs, and uses stock 0 when there's no `product_stock` row.
- [x] `getProduct` (unknown slug → undefined, includes stock), `getRelatedProducts` (same category first, excludes the product itself), `getCategory`, `getCategoryProducts`, `getNewArrivals`, `getGiftEdit` and `getHomeCategories` (ordering and null-image filtering).

### Phase 3: Bag (integration, cookie mock + DB)
- [x] `bag-server.ts`: `writeBag` deletes the cookie when the bag is empty and otherwise sets the options (non-httpOnly, 30 days); `getBag` drops deleted products, clamps to `min(quantity, stock)` and keeps `requested`.
- [x] `addToBag`: rejects invalid IDs (string, float, negative, object), unknown and sold-out products; increments existing lines; fixes up a stale cookie above stock; enforces `MAX_BAG_LINES`.
- [x] `updateBagQuantity`: 0 removes the line; clamps to stock with an "Only N available" message; a sold-out product is removed; an invalid quantity or missing line is rejected.
- [x] `removeFromBag`: removes the line, and invalid input leaves the cookie unchanged.

### Phase 4: Checkout and orders (integration, highest risk)
- [x] `reserveOrder`: decrements stock, snapshots names and prices, ignores client-side prices; handles `empty` and `below_minimum`; **concurrency**: two parallel reservations for a product with stock 1 produce exactly one order.
- [x] `releaseOrder`: returns stock exactly once (a second call is a no-op), skips items whose product was deleted, and only acts on `pending`/`processing`.
- [x] `applyCheckoutSession`: covers each transition's writes (`paid` sets `paidAt`, payment intent, email coalesce and shipping; `processing`; `release`; `needs_review`), plus `unknown_order` and `session_mismatch`. The DB check constraints stay satisfied.
- [x] `processStripeEvent`: ignores non-checkout events; a duplicate event ID returns `duplicate`; an error inside the transaction leaves no `stripe_events` row.
- [x] Stripe-backed functions (stubbed): `createCheckoutSession` (payload built from DB lines, idempotency key, session ID stored), `abandonCheckout` (no session → failed; `expire` throws → `retrieve` and apply), `syncCheckoutSession` (invalid ID or `StripeInvalidRequestError` → null), `getOpenCheckout` (only open, unexpired sessions; works when Stripe is unreachable).
- [x] `startCheckout` action: empty bag; abandons the previous checkout from the cookie; reservation errors; a Stripe create failure → `failOrder` and stock restored; success sets the httpOnly checkout cookie and redirects. `completeCheckout`: only clears the bag when the cookie matches a `paid` order.
- [x] Webhook `POST` route: missing secret → 500, missing or invalid signature → 400 with no DB change, a valid signed event → applied, a processing error → 500.
- [x] Cancel `GET` route: cookie mismatch → bag, paid in another tab → success page, normal cancel → stock released and cookie deleted.
- [x] `getStaleOrders` age cut-off (backdate `createdAt`) and the reconcile flow (no session → released).

### Phase 5: Auth and access control (integration)
- [x] `proxy.ts`: redirects to `/sign-in?next=<path+search>` without a session cookie and passes through with one (build a `NextRequest` directly).
- [x] `session.ts` (with `auth.api.getSession` mocked): `requireSession` redirects with an encoded `next`; `requireAdmin` redirects anonymous users, calls `notFound()` for customers, and passes admins with `disableCookieCache`.
- [x] Better Auth against the test DB: sign up and sign in via `auth.api`; `role` defaults to `customer` and can't be set through sign-up input; the `make-admin` logic grants admin.

### Phase 6: Order history (integration)
- [x] `getCustomerOrders`: scoped to the user, placed orders only (excludes `pending`, `expired`, and `failed` without a payment intent), newest first, respects `limit`.
- [x] `getCustomerOrder`: another user's order, an invalid ID or a non-placed order → undefined; items include product slug and image, and a deleted product still shows its snapshot.

### Phase 7: Client components with logic (component)
- [x] `BagLink` (count from the cookie, updates on the `bag-change` event), `useBagAction` (dispatches the event), `QuantityStepper` bounds, `AuthForm` (errors and `safeNext` redirect), `PaymentStatusPoller` (stops on a final status, using fake timers).

### Phase 8: E2E (Playwright)
- [x] `playwright.config.ts`: `webServer` runs build + start against the test DB (seeded with `db:seed`), Chromium only to start.
- [x] Flows: browse → product → add to bag → header count → change quantity → remove; sign up → account → sign out; `/account` and `/admin` redirect when signed out, and `/admin` 404s for a customer; checkout start redirects to `checkout.stripe.com` and a signed webhook marks the order paid, after which it appears in order history. This flow runs only when a sandbox `STRIPE_SECRET_KEY` is present and is skipped otherwise.

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
- **2026-10-08, Phase 1 follow-up:** after the merge, `safeNext` also rejects same-origin paths that normalize to `//…` (e.g. `/.//evil.com`, `/a/..//evil.com`), which the first fix would have returned as a protocol-relative URL (commit `49eb03d`). Phase 2 adds the regression test to `redirects.test.ts`.
- **2026-10-08, Phase 2** (branch `test/phase-2-catalog-reads`): `tests/integration/lib/products.test.ts` has 19 tests covering every export of `lib/products.ts`, with fixed `createdAt` values so "newest first" is deterministic. No bugs found. Checked by breaking the code twice: removing the LIKE escaping and removing the name-first ranking each make the matching tests fail.
- **2026-10-08, Phase 3** (branch `test/phase-3-bag`): `tests/integration/lib/bag-server.test.ts` (readBag, writeBag cookie options, getBag clamping and ordering) and `tests/integration/app/bag/actions.test.ts` (every action, with a table of invalid inputs a client could send). Two bugs found and fixed:
  - **Form strings were parsed with `Number()`.** `updateBagQuantity(id, "")` turned `""` into 0, deleted the line and reported "Removed from your bag." `" 2"`, `"1e3"` and `"0x10"` were also accepted. The actions now accept only plain digit strings. The UI only sends numbers, so this was reachable only through crafted requests, which affect nothing but the caller's own bag.
  - **Quantities the cookie can't hold.** Cookie lines store at most 4 digits, but the actions only clamped to stock. With 10,000+ in stock, setting quantity 20,000 reported success and wrote `id:20000`, which `parseBag` then dropped, so the line vanished. A new `MAX_LINE_QUANTITY` (9,999) in `lib/bag.ts` is used by `parseBag` and by the actions, which now cap at `min(stock, MAX_LINE_QUANTITY)`.
- **2026-10-08, Phases 4–7** (branch `test/phases-4-7`): 131 new tests. No application bugs found.
  - **Phase 4, checkout and orders** (77 tests): `tests/integration/lib/orders/` (`reservation`, `apply-session`, `stripe-sessions`, `reconcile`) plus the checkout actions, the cancel route and the Stripe webhook route under `tests/integration/app/`. Covers concurrent reservations (the last piece, and bags listing products in opposite orders), rollback on an integer-overflow insert, every session transition and the `orders_paid_or_released_check`, webhook signature/tamper/missing-secret handling, and rollback on processing errors.
  - **Phase 5, auth and access** (19 tests): `proxy.test.ts`, `lib/session.test.ts`, `lib/auth.test.ts`, `db/roles.test.ts`. Instead of mocking `auth.api.getSession` as planned, the tests use **real Better Auth sessions** via `tests/helpers/auth.ts` (`signUpAndSignIn`). This also checks that `requireAdmin` bypasses the 5-minute cookie cache. Better Auth's `nextCookies()` doesn't write to the test cookie jar, so the helper copies Set-Cookie headers in itself.
  - **Phase 6, order history** (8 tests): `lib/orders/history.test.ts`.
  - **Phase 7, components** (27 tests): `tests/unit/components/` for `BagLink`, `useBagAction`, `QuantityStepper`, `AuthForm` and `PaymentStatusPoller`. The poller doesn't know the order status itself: the success page stops rendering it once the status is final. So the tests cover the 2 s interval, giving up after 15 attempts, "Check again", and stopping on unmount.
  - **Refactors for testability** (no behaviour change): the loop in `pnpm orders:reconcile` moved into `reconcileStaleOrders()` in `lib/orders.ts`, and `pnpm auth:make-admin` now calls `grantAdminRole()` in a new `src/db/roles.ts`. The scripts kept only their CLI parts, because importing them would load `.env` and close the shared pool.
  - **New helpers:** `tests/helpers/auth.ts`, `tests/helpers/checkout.ts` (`createReservedOrder` via the real `reserveOrder`), `tests/helpers/queries.ts`, and `testCookies.remove()`.
  - **Mutation checks:** removing the stock row lock, the `user_id` filter in `getCustomerOrder`, or `disableCookieCache` in `requireAdmin` each make a test fail.
- **2026-10-08, Phase 8** (branch `test/phase-8-e2e`): Playwright with Chromium. 10 specs, plus the checkout spec, which needs a key.
  - **Server:** `playwright.config.ts` runs `tests/e2e/prepare.ts` (migrate, truncate, `db:seed` on the `_test` DB), then `next build` + `next start` on port 3100. `reuseExistingServer` is false so every run starts clean. All server env is fixed in `tests/e2e/env.ts`, not read from `.env`.
  - **Build output:** an E2E-only build folder (`distDir: .next-e2e`) was tried and dropped. `next build` then rewrote `tsconfig.json` and `next-env.d.ts` to point at it, and Next 16 already keeps `next dev` in `.next/dev`, so build and dev can run at the same time.
  - **Specs:**
    - `shopping.spec.ts`: browse → product → bag count → quantity → remove; the stock limit and a reload; sold out; search.
    - `auth.spec.ts`: sign up → account → sign out; return to `next` after sign-in; crafted `?next=` values (`//`, `%09`, `/.//`) stay on the site; protected-page redirects; a customer gets a 404 from `/admin`; the sign-in rate limit.
    - `checkout.spec.ts`: a real sandbox Checkout Session, with the redirect to `checkout.stripe.com` intercepted; a signed `checkout.session.completed` webhook marks the order paid; the success page clears the bag; the order appears in the account. It runs only with `E2E_STRIPE_SECRET_KEY`. Verified on 2026-10-08 against the Stripe sandbox (3 consecutive green runs).
  - **Rate limiting:** Better Auth limits sign-up and sign-in to 3 per 10 s per IP in production builds, and parallel tests all came from 127.0.0.1. The shared `test` fixture in `tests/e2e/helpers.ts` gives each test its own `X-Forwarded-For` IP, and a spec checks that the limit kicks in.
  - **Not an app bug:** Next's route announcer also has `role="alert"`, so specs scope alert lookups to `<main>`.
  - Stable over `--repeat-each 3` (30/30).
  - **First checkout run:** the server logged `⨯ Error: The destination stream closed early.` when the spec left `/checkout/success`. Cause: `ClearBagOnSuccess` calls `completeCheckout`, which changes cookies, so Next streams a re-render of the page after the action's result. That re-render takes ~0.4 s, because `loadOrder()` calls Stripe again. The client resolves the action at the first chunk (~66 ms), so the test navigated away mid-stream. Replaying the captured request showed the server finishes normally (462 ms), so it was harmless. The spec now waits for the action's Resource Timing entry before leaving; `networkidle` and `response.finished()` never fired for this streamed fetch in Chromium.
  - **Follow-ups, not fixed here:**
    - Footer links point to pages that don't exist (`/help/contact`, `/help/shipping`, `/help/returns`, `/help/care`, `/about`, `/about/craft`, `/about/sustainability`, `/careers`). Their prefetches return 404 on every page.
    - Clearing the bag after payment re-renders the success page, which asks Stripe for the session a second time.
