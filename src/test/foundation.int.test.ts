// Smoke tests for the integration test harness itself: database reset, factories, and the
// next/headers, Stripe and navigation stand-ins. Run with: pnpm test:int
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { describe, expect, test } from "vitest";
import { db } from "@/db";
import { orderItems, products, productStock } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { assertTestDatabaseUrl } from "./env";
import { createOrder, createProduct, createUser } from "./factories";
import { expectNotFound, expectRedirect } from "./navigation";
import { testCookies } from "./next-headers";
import { invalidRequestError, makeCheckoutSession, makeEvent, signedWebhookRequest, stripeMock } from "./stripe";

describe("test database", () => {
  test("only accepts databases whose name ends in _test", () => {
    expect(() => assertTestDatabaseUrl("postgres://localhost:5432/atelier")).toThrow(/_test/);
    expect(() => assertTestDatabaseUrl(undefined)).toThrow(/DATABASE_URL/);
    expect(assertTestDatabaseUrl(process.env.DATABASE_URL)).toMatch(/_test$/);
  });

  test("factories insert products with stock, users and orders", async () => {
    const product = await createProduct({ priceCents: 2500, stock: 3 });
    const user = await createUser();
    const order = await createOrder({
      userId: user.id,
      status: "paid",
      items: [{ product, quantity: 2 }],
    });

    const [stock] = await db.select().from(productStock).where(eq(productStock.productId, product.id));
    expect(stock.quantity).toBe(3);
    expect(order).toMatchObject({ status: "paid", totalCents: 5000, userId: user.id });
    expect(order.paidAt).toBeInstanceOf(Date);
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    expect(items).toMatchObject([{ productId: product.id, unitPriceCents: 2500, quantity: 2 }]);
  });

  test("a product can be created without a stock row", async () => {
    const product = await createProduct({ stock: null });
    expect(await db.select().from(productStock).where(eq(productStock.productId, product.id))).toEqual([]);
  });

  test("every test starts from empty tables with restarted identities", async () => {
    expect(await db.select().from(products)).toEqual([]);
    const product = await createProduct();
    expect(product.id).toBe(1);
  });
});

describe("next/headers stand-in", () => {
  test("cookies() reads seeded cookies and records writes", async () => {
    testCookies.seed({ atelier_bag: "12:2" });
    const store = await cookies();
    expect(store.get("atelier_bag")?.value).toBe("12:2");

    store.set("atelier_checkout", "order-1", { httpOnly: true, maxAge: 3600 });
    expect(testCookies.value("atelier_checkout")).toBe("order-1");
    expect(testCookies.options("atelier_checkout")).toEqual({ httpOnly: true, maxAge: 3600 });

    store.delete("atelier_bag");
    expect(testCookies.value("atelier_bag")).toBeUndefined();
  });

  test("headers() carries the cookie jar and extra headers", async () => {
    testCookies.seed({ a: "1", b: "x y" });
    testCookies.setHeader("user-agent", "vitest");
    const result = await headers();
    expect(result.get("cookie")).toBe("a=1; b=x%20y");
    expect(result.get("user-agent")).toBe("vitest");
  });

  test("cookies are reset between tests", async () => {
    expect((await cookies()).getAll()).toEqual([]);
  });
});

describe("Stripe stand-in", () => {
  test("tests always get the dummy Stripe and auth settings, never real keys", () => {
    expect(process.env.STRIPE_SECRET_KEY).toBe("sk_test_offline");
    expect(process.env.STRIPE_WEBHOOK_SECRET).toBe("whsec_test_offline");
    expect(process.env.BETTER_AUTH_SECRET).toBe("test-secret-at-least-32-characters-long");
    expect(process.env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  test("getStripe() returns the stub, and unstubbed calls fail instead of reaching Stripe", async () => {
    expect(getStripe()).toBe(stripeMock);
    await expect(getStripe().checkout.sessions.retrieve("cs_test_1")).rejects.toThrow(/isn't stubbed/);
  });

  test("calls can be stubbed per test", async () => {
    const session = makeCheckoutSession({ orderId: "3f1c2b9e-8f44-4d7a-9a8e-1b2c3d4e5f60" });
    stripeMock.checkout.sessions.retrieve.mockResolvedValue(session);
    await expect(getStripe().checkout.sessions.retrieve(session.id)).resolves.toBe(session);
    expect(session.metadata).toEqual({ orderId: "3f1c2b9e-8f44-4d7a-9a8e-1b2c3d4e5f60" });

    stripeMock.checkout.sessions.expire.mockRejectedValue(invalidRequestError());
    await expect(getStripe().checkout.sessions.expire(session.id)).rejects.toMatchObject({
      type: "StripeInvalidRequestError",
    });
  });

  test("signed webhook requests verify with the real SDK", async () => {
    const event = makeEvent("checkout.session.completed", makeCheckoutSession());
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

    const valid = signedWebhookRequest(event);
    const parsed = getStripe().webhooks.constructEvent(
      await valid.text(),
      valid.headers.get("stripe-signature") ?? "",
      secret,
    );
    expect(parsed.id).toBe(event.id);

    const forged = signedWebhookRequest(event, "whsec_wrong");
    expect(() =>
      getStripe().webhooks.constructEvent(
        JSON.stringify(event),
        forged.headers.get("stripe-signature") ?? "",
        secret,
      ),
    ).toThrow();
  });
});

describe("navigation helpers", () => {
  test("expectRedirect returns the redirect target", async () => {
    expect(await expectRedirect(() => redirect("/sign-in?next=%2Faccount"))).toBe("/sign-in?next=%2Faccount");
    await expect(expectRedirect(() => undefined)).rejects.toThrow(/nothing was thrown/);
  });

  test("expectNotFound accepts notFound() only", async () => {
    await expectNotFound(() => notFound());
    await expect(expectNotFound(() => redirect("/"))).rejects.toThrow();
  });
});
