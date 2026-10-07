import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { reserveOrder } from "@/lib/orders";

type Line = { product: { id: number }; quantity?: number };

/**
 * Reserves stock through the real `reserveOrder` (so stock is decremented) and, unless
 * `sessionId` is null, records a Checkout Session ID as `createCheckoutSession` would.
 */
export async function createReservedOrder(
  lines: Line[],
  {
    sessionId = `cs_test_${randomBytes(8).toString("hex")}`,
    userId = null,
    email = null,
  }: { sessionId?: string | null; userId?: string | null; email?: string | null } = {},
) {
  const reservation = await reserveOrder({
    bag: lines.map(({ product, quantity = 1 }) => ({ productId: product.id, quantity })),
    userId,
    email,
  });
  if (!reservation.ok) throw new Error(`Reservation failed: ${reservation.reason}`);
  if (sessionId) {
    await db.update(orders).set({ stripeCheckoutSessionId: sessionId }).where(eq(orders.id, reservation.orderId));
  }
  return { ...reservation, sessionId };
}
