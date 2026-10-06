"use client";

import { useEffect } from "react";
import { completeCheckout } from "@/app/checkout/actions";
import { BAG_CHANGE_EVENT } from "@/lib/bag";

/**
 * Empties the bag after a paid checkout. Cookies can't be written while a Server Component
 * renders, so this runs as an action once the confirmation page has loaded.
 */
export function ClearBagOnSuccess({ orderId }: { orderId: string }) {
  useEffect(() => {
    completeCheckout(orderId)
      .then((cleared) => {
        if (cleared) window.dispatchEvent(new Event(BAG_CHANGE_EVENT));
      })
      .catch(() => {
        // The bag simply stays as it was; the order is already paid.
      });
  }, [orderId]);

  return null;
}
