// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/app/checkout/actions.test.ts)
import { afterEach, describe, expect, test, vi } from "vitest";
import { completeCheckout, startCheckout } from "@/app/checkout/actions";
import { BAG_COOKIE } from "@/lib/bag";
import { CHECKOUT_COOKIE } from "@/lib/checkout";
import { signUpAndSignIn } from "@tests/helpers/auth";
import { createReservedOrder } from "@tests/helpers/checkout";
import { createOrder, createProduct } from "@tests/helpers/factories";
import { expectRedirect } from "@tests/helpers/navigation";
import { testCookies } from "@tests/helpers/next-headers";
import { getOrder, getOrders, getStock } from "@tests/helpers/queries";
import { makeCheckoutSession, stripeMock } from "@tests/helpers/stripe";

const { sessions } = stripeMock.checkout;
const STRIPE_URL = "https://checkout.stripe.com/c/pay/cs_test_new";

afterEach(() => {
  vi.restoreAllMocks();
});

function stubSessionCreated() {
  sessions.create.mockResolvedValue(makeCheckoutSession({ id: "cs_test_new", url: STRIPE_URL }));
}

describe("startCheckout", () => {
  test("an empty bag doesn't start a checkout", async () => {
    expect(await startCheckout()).toEqual({ message: "Your bag is empty." });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  test("reserves the bag, opens a Stripe session and redirects there", async () => {
    const tote = await createProduct({ priceCents: 48_000, stock: 3 });
    testCookies.seed({ [BAG_COOKIE]: `${tote.id}:2` });
    stubSessionCreated();

    expect(await expectRedirect(() => startCheckout())).toBe(STRIPE_URL);

    const [order] = await getOrders();
    expect(order).toMatchObject({ status: "pending", userId: null, email: null, totalCents: 96_000, stripeCheckoutSessionId: "cs_test_new" });
    expect(await getStock(tote.id)).toBe(1);
    expect(testCookies.value(CHECKOUT_COOKIE)).toBe(order.id);
    expect(testCookies.options(CHECKOUT_COOKIE)).toEqual({ path: "/", sameSite: "lax", secure: false, httpOnly: true, maxAge: 3600 });
    expect(testCookies.value(BAG_COOKIE)).toBe(`${tote.id}:2`); // cleared only once paid
  });

  test("links the order to a signed-in customer", async () => {
    const customer = await signUpAndSignIn({ email: "member@example.com" });
    const tote = await createProduct();
    testCookies.seed({ [BAG_COOKIE]: `${tote.id}:1` });
    stubSessionCreated();

    await expectRedirect(() => startCheckout());
    expect((await getOrders())[0]).toMatchObject({ userId: customer.id, email: "member@example.com" });
    expect(sessions.create.mock.calls[0][0].customer_email).toBe("member@example.com");
  });

  test("releases this browser's previous checkout first, so its hold doesn't block the new one", async () => {
    const lastOne = await createProduct({ stock: 1 });
    const previous = await createReservedOrder([{ product: lastOne }], { sessionId: null });
    testCookies.seed({ [BAG_COOKIE]: `${lastOne.id}:1`, [CHECKOUT_COOKIE]: previous.orderId });
    stubSessionCreated();

    await expectRedirect(() => startCheckout());
    expect((await getOrder(previous.orderId)).status).toBe("failed");
    expect(await getStock(lastOne.id)).toBe(0);
    expect(testCookies.value(CHECKOUT_COOKIE)).not.toBe(previous.orderId);
  });

  test("carries on when the previous checkout can't be released", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const tote = await createProduct({ stock: 5 });
    const previous = await createReservedOrder([{ product: tote }]);
    testCookies.seed({ [BAG_COOKIE]: `${tote.id}:1`, [CHECKOUT_COOKIE]: previous.orderId });
    sessions.expire.mockRejectedValue(new Error("Stripe is down"));
    sessions.retrieve.mockRejectedValue(new Error("Stripe is down"));
    stubSessionCreated();

    expect(await expectRedirect(() => startCheckout())).toBe(STRIPE_URL);
    expect((await getOrder(previous.orderId)).status).toBe("pending");
  });

  test("tells the shopper when everything in the bag just sold out", async () => {
    const soldOut = await createProduct({ stock: 0 });
    testCookies.seed({ [BAG_COOKIE]: `${soldOut.id}:1` });

    expect(await startCheckout()).toEqual({
      message: "The pieces in your bag have just sold out, so there's nothing to check out.",
      refresh: true,
    });
    expect(await getOrders()).toEqual([]);
  });

  test("refuses totals below the minimum charge", async () => {
    const sticker = await createProduct({ priceCents: 10 });
    testCookies.seed({ [BAG_COOKIE]: `${sticker.id}:1` });

    expect(await startCheckout()).toEqual({ message: "Your order is below the minimum amount we can charge." });
  });

  test("reports a reservation error without charging or holding stock", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const vault = await createProduct({ priceCents: 2_000_000_000, stock: 5 });
    testCookies.seed({ [BAG_COOKIE]: `${vault.id}:2` });

    expect(await startCheckout()).toEqual({ message: "We couldn't start checkout. Nothing has been charged. Please try again." });
    expect(await getStock(vault.id)).toBe(5);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  test("fails the order and returns its stock when Stripe can't create a session", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const tote = await createProduct({ stock: 2 });
    testCookies.seed({ [BAG_COOKIE]: `${tote.id}:1` });
    sessions.create.mockRejectedValue(new Error("Stripe is down"));

    expect(await startCheckout()).toEqual({
      message: "We couldn't reach our payment provider. Nothing has been charged. Please try again.",
    });
    const [order] = await getOrders();
    expect(order.status).toBe("failed");
    expect(await getStock(tote.id)).toBe(2);
    expect(testCookies.value(CHECKOUT_COOKIE)).toBeUndefined();
  });
});

describe("completeCheckout", () => {
  test("empties the bag once this browser's order is paid", async () => {
    const order = await createOrder({ status: "paid" });
    testCookies.seed({ [BAG_COOKIE]: "9001:1", [CHECKOUT_COOKIE]: order.id });

    expect(await completeCheckout(order.id)).toBe(true);
    expect(testCookies.value(BAG_COOKIE)).toBeUndefined();
    expect(testCookies.value(CHECKOUT_COOKIE)).toBeUndefined();
  });

  test.each(["pending", "processing", "needs_review", "failed"] as const)("keeps the bag while the order is %s", async (status) => {
    const order = await createOrder({ status });
    testCookies.seed({ [BAG_COOKIE]: "9001:1", [CHECKOUT_COOKIE]: order.id });

    expect(await completeCheckout(order.id)).toBe(false);
    expect(testCookies.value(BAG_COOKIE)).toBe("9001:1");
  });

  test("only acts for the browser that started the checkout", async () => {
    const order = await createOrder({ status: "paid" });
    testCookies.seed({ [BAG_COOKIE]: "9001:1" });

    expect(await completeCheckout(order.id)).toBe(false);
    testCookies.seed({ [CHECKOUT_COOKIE]: "someone-else" });
    expect(await completeCheckout(order.id)).toBe(false);
    expect(await completeCheckout({ id: order.id })).toBe(false);
    expect(testCookies.value(BAG_COOKIE)).toBe("9001:1");
  });
});

