"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BAG_COOKIE } from "@/lib/bag";
import { readBag } from "@/lib/bag-server";
import { CHECKOUT_COOKIE, type CheckoutActionState } from "@/lib/checkout";
import {
  abandonCheckout,
  createCheckoutSession,
  failOrder,
  getOrderStatus,
  reserveOrder,
} from "@/lib/orders";
import { getSession } from "@/lib/session";

// Checkout actions. Server actions are public endpoints: these take no prices, totals or
// payment state from the caller. The bag cookie only names products and quantities.

/** Reserves stock for the bag, records a pending order and sends the shopper to Stripe. */
export async function startCheckout(): Promise<CheckoutActionState> {
  const bag = await readBag();
  if (bag.length === 0) return { message: "Your bag is empty." };

  // Guests can check out; signed-in customers get the order linked to their account.
  const session = await getSession();
  const store = await cookies();

  // Release this browser's earlier, unfinished checkout first, so its reservation doesn't
  // count against the new one.
  const previous = store.get(CHECKOUT_COOKIE)?.value;
  if (previous) {
    try {
      await abandonCheckout(previous);
    } catch (error) {
      // Not fatal: the old session still expires on its own and the webhook releases it.
      console.error("Couldn't release the previous checkout", error);
    }
  }

  let reservation: Awaited<ReturnType<typeof reserveOrder>>;
  try {
    reservation = await reserveOrder({
      bag,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
    });
  } catch (error) {
    console.error("Couldn't reserve stock for checkout", error);
    return { message: "We couldn't start checkout. Nothing has been charged. Please try again." };
  }
  if (!reservation.ok) {
    return reservation.reason === "empty"
      ? {
          message: "The pieces in your bag have just sold out, so there's nothing to check out.",
          refresh: true,
        }
      : { message: "Your order is below the minimum amount we can charge." };
  }

  let url: string;
  try {
    url = await createCheckoutSession(reservation, session?.user.email ?? null);
  } catch (error) {
    console.error(`Couldn't create a Checkout Session for order ${reservation.orderId}`, error);
    await failOrder(reservation.orderId);
    return {
      message: "We couldn't reach our payment provider. Nothing has been charged. Please try again.",
    };
  }

  store.set(CHECKOUT_COOKIE, reservation.orderId, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 60,
  });
  // Outside the try: redirect() throws to navigate.
  redirect(url);
}

/**
 * Empties the bag once this browser's checkout is paid. The status comes from our database,
 * which only Stripe (webhook or server-side retrieve) can move to "paid".
 */
export async function completeCheckout(orderId: unknown) {
  const store = await cookies();
  if (typeof orderId !== "string" || store.get(CHECKOUT_COOKIE)?.value !== orderId) return false;
  if ((await getOrderStatus(orderId)) !== "paid") return false;
  store.delete(BAG_COOKIE);
  store.delete(CHECKOUT_COOKIE);
  return true;
}
