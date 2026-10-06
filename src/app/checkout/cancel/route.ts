import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { CHECKOUT_COOKIE } from "@/lib/checkout";
import { abandonCheckout } from "@/lib/orders";

// Stripe's cancel_url, and the bag's "Cancel checkout" link. Expires the session and returns the
// reserved stock straight away instead of waiting for the session to time out. Only the browser
// that started the checkout (matching httpOnly cookie) can cancel it; anyone else is just sent
// back to the bag.
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("order");
  const store = await cookies();
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  if (!orderId || store.get(CHECKOUT_COOKIE)?.value !== orderId) {
    return to("/bag?checkout=cancelled");
  }

  let result: Awaited<ReturnType<typeof abandonCheckout>>;
  try {
    result = await abandonCheckout(orderId);
  } catch (error) {
    // The session still expires on its own and the webhook releases the stock then.
    console.error(`Couldn't cancel checkout for order ${orderId}`, error);
    return to("/bag?checkout=cancel-failed");
  }

  // Paid (or being paid) in another tab before the cancel landed: show the order, not the bag.
  if (
    result?.sessionId &&
    (result.status === "paid" || result.status === "processing" || result.status === "needs_review")
  ) {
    return to(`/checkout/success?session_id=${encodeURIComponent(result.sessionId)}`);
  }

  store.delete(CHECKOUT_COOKIE);
  return to("/bag?checkout=cancelled");
}
