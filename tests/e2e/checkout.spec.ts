// Run with: E2E_STRIPE_SECRET_KEY=sk_test_… pnpm test:e2e (or set it in .env.test)
import Stripe from "stripe";
import { E2E_STRIPE_SECRET_KEY, E2E_WEBHOOK_SECRET } from "./env";
import { bagLink, expect, signUp, test } from "./helpers";

// Creates a real Checkout Session in the Stripe sandbox, so it needs a test-mode key. Stripe's
// hosted page isn't loaded; payment is simulated with a webhook signed like Stripe's.
test.skip(!E2E_STRIPE_SECRET_KEY, "Set E2E_STRIPE_SECRET_KEY (a Stripe test-mode key) to run the checkout flow.");

test("check out, get paid through the webhook, and see the order in the account", async ({ page, request }) => {
  const stripe = new Stripe(E2E_STRIPE_SECRET_KEY ?? "");
  await signUp(page);

  await page.goto("/products/structured-top-handle-bag");
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(bagLink(page)).toHaveAccessibleName("Shopping bag, 1 item");
  await page.goto("/bag");

  // Stop at Stripe's door: capture the redirect instead of loading the hosted page.
  await page.route("https://checkout.stripe.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Stripe Checkout</title>" }),
  );
  await page.getByRole("button", { name: "Checkout" }).click();
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//);
  const sessionId = /\/(cs_test_[A-Za-z0-9]+)/.exec(page.url())?.[1];
  expect(sessionId).toBeTruthy();

  const session = await stripe.checkout.sessions.retrieve(sessionId ?? "");
  try {
    expect(session.amount_total).toBe(245_000);
    expect(session.metadata?.orderId).toBeTruthy();

    // What Stripe sends once the customer pays.
    const paid = { ...session, status: "complete", payment_status: "paid", payment_intent: `pi_e2e_${Date.now()}` };
    const payload = JSON.stringify({
      id: `evt_e2e_${Date.now()}`,
      object: "event",
      type: "checkout.session.completed",
      api_version: "2026-08-26.dahlia",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      data: { object: paid },
    });
    const response = await request.post("/api/webhooks/stripe", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: E2E_WEBHOOK_SECRET }),
      },
      data: payload,
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ received: true, result: "paid" });

    await page.goto(`/checkout/success?session_id=${sessionId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you for your order");
    await expect(bagLink(page)).toHaveAccessibleName("Shopping bag");
    // The bag is cleared by the completeCheckout server action. It changes cookies, so after its
    // result Next streams a re-render of this page (~0.5 s, as it asks Stripe again). Wait until
    // that response is complete (a Resource Timing entry exists only once it is), or leaving now
    // makes the server log "The destination stream closed early".
    await page.waitForFunction(() =>
      performance
        .getEntriesByType("resource")
        .some((entry) => entry.name.includes("/checkout/success") && (entry as PerformanceResourceTiming).initiatorType === "fetch"),
    );

    await page.goto("/account");
    const reference = (session.metadata?.orderId ?? "").slice(0, 8).toUpperCase();
    await page.getByRole("link", { name: new RegExp(reference) }).click();
    await expect(page.getByText("Structured Top-Handle Bag")).toBeVisible();
  } finally {
    // Don't leave an open session behind in the sandbox.
    await stripe.checkout.sessions.expire(session.id).catch(() => {});
  }
});
