// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/app/checkout/cancel/route.test.ts)
import { NextRequest } from "next/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GET } from "@/app/checkout/cancel/route";
import { CHECKOUT_COOKIE } from "@/lib/checkout";
import { createReservedOrder } from "@tests/helpers/checkout";
import { createProduct } from "@tests/helpers/factories";
import { testCookies } from "@tests/helpers/next-headers";
import { getOrder, getStock } from "@tests/helpers/queries";
import { invalidRequestError, makeCheckoutSession, stripeMock } from "@tests/helpers/stripe";

const { sessions } = stripeMock.checkout;
const cancel = (orderId?: string) =>
  GET(new NextRequest(`http://localhost:3000/checkout/cancel${orderId ? `?order=${orderId}` : ""}`));

afterEach(() => {
  vi.restoreAllMocks();
});

async function openCheckout() {
  const tote = await createProduct({ priceCents: 48_000, stock: 1 });
  const order = await createReservedOrder([{ product: tote }]);
  testCookies.seed({ [CHECKOUT_COOKIE]: order.orderId });
  return { tote, ...order };
}

describe("GET /checkout/cancel", () => {
  test("expires the session, returns the stock and goes back to the bag", async () => {
    const { tote, orderId, sessionId } = await openCheckout();
    sessions.expire.mockResolvedValue(makeCheckoutSession({ id: sessionId ?? undefined, orderId, status: "expired", payment_status: "unpaid" }));

    const response = await cancel(orderId);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/bag?checkout=cancelled");
    expect((await getOrder(orderId)).status).toBe("expired");
    expect(await getStock(tote.id)).toBe(1);
    expect(testCookies.value(CHECKOUT_COOKIE)).toBeUndefined();
  });

  test("only the browser that started the checkout can cancel it", async () => {
    const { orderId } = await openCheckout();
    testCookies.reset();

    const response = await cancel(orderId);
    expect(response.headers.get("location")).toBe("http://localhost:3000/bag?checkout=cancelled");
    expect((await getOrder(orderId)).status).toBe("pending");
    expect(sessions.expire).not.toHaveBeenCalled();

    expect((await cancel()).headers.get("location")).toBe("http://localhost:3000/bag?checkout=cancelled");
  });

  test("shows the order instead when it was paid in another tab", async () => {
    const { orderId, sessionId } = await openCheckout();
    sessions.expire.mockRejectedValue(invalidRequestError("Only open sessions can be expired."));
    sessions.retrieve.mockResolvedValue(makeCheckoutSession({ id: sessionId ?? undefined, orderId, amount_total: 48_000 }));

    const response = await cancel(orderId);

    expect(response.headers.get("location")).toBe(`http://localhost:3000/checkout/success?session_id=${sessionId}`);
    expect((await getOrder(orderId)).status).toBe("paid");
    expect(testCookies.value(CHECKOUT_COOKIE)).toBe(orderId);
  });

  test("reports a failed cancel and leaves the order to expire on its own", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { orderId } = await openCheckout();
    sessions.expire.mockRejectedValue(new Error("Stripe is down"));
    sessions.retrieve.mockRejectedValue(new Error("Stripe is down"));

    const response = await cancel(orderId);
    expect(response.headers.get("location")).toBe("http://localhost:3000/bag?checkout=cancel-failed");
    expect((await getOrder(orderId)).status).toBe("pending");
  });
});
