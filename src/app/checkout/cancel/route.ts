import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { CHECKOUT_COOKIE } from "@/lib/checkout";
import { abandonCheckout } from "@/lib/orders";

// Stripe's cancel_url. Expires the session and returns the reserved stock straight away
// instead of waiting for the session to time out. Only the browser that started the checkout
// (matching httpOnly cookie) can cancel it; anyone else is just sent back to the bag.
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("order");
  const store = await cookies();

  if (orderId && store.get(CHECKOUT_COOKIE)?.value === orderId) {
    try {
      await abandonCheckout(orderId);
      store.delete(CHECKOUT_COOKIE);
    } catch (error) {
      // The session still expires on its own and the webhook releases the stock then.
      console.error(`Couldn't cancel checkout for order ${orderId}`, error);
    }
  }

  return NextResponse.redirect(new URL("/bag?checkout=cancelled", request.url), 303);
}
