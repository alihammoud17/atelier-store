// Settles checkouts whose webhooks were missed: retrieves each stale pending or processing
// order's session from Stripe and applies the same transitions as the webhook.
// Usage: pnpm orders:reconcile
import "dotenv/config";
import { db } from "./index";
import { reconcileStaleOrders } from "@/lib/orders";

// Sessions expire after 31 minutes, so anything older has a final state at Stripe.
const STALE_AFTER_MINUTES = 35;

async function main() {
  const results = await reconcileStaleOrders(STALE_AFTER_MINUTES);
  console.log(`${results.length} stale order(s)`);

  for (const result of results) {
    if (result.outcome === "released") {
      console.log(`${result.orderId}: no session, released`);
    } else if (result.outcome === "synced") {
      const { session } = result;
      console.log(
        `${result.orderId}: ${session ? `Stripe ${session.status}/${session.payment_status}` : "unknown to Stripe"}`,
      );
    } else {
      console.error(`${result.orderId}: failed`, result.error);
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
