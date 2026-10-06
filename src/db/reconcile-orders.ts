// Settles checkouts whose webhooks were missed: retrieves each stale pending or processing
// order's session from Stripe and applies the same transitions as the webhook.
// Usage: pnpm orders:reconcile
import "dotenv/config";
import { db } from "./index";
import { failOrder, getStaleOrders, syncCheckoutSession } from "@/lib/orders";

// Sessions expire after 31 minutes, so anything older has a final state at Stripe.
const STALE_AFTER_MINUTES = 35;

async function main() {
  const stale = await getStaleOrders(STALE_AFTER_MINUTES);
  console.log(`${stale.length} stale order(s)`);

  for (const order of stale) {
    try {
      if (!order.sessionId) {
        // The Checkout Session was never created, so nothing can be paid.
        await failOrder(order.id);
        console.log(`${order.id}: no session, released`);
        continue;
      }
      const session = await syncCheckoutSession(order.sessionId);
      console.log(
        `${order.id}: ${session ? `Stripe ${session.status}/${session.payment_status}` : "unknown to Stripe"}`,
      );
    } catch (error) {
      console.error(`${order.id}: failed`, error);
      process.exitCode = 1;
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
