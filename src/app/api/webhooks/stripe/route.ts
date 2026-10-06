import type Stripe from "stripe";
import { processStripeEvent } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";

// Stripe webhook endpoint. Nothing in the body is trusted until the signature checks out.
// Subscribe it to checkout.session.completed, .async_payment_succeeded, .async_payment_failed
// and .expired.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set.");
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  // The signature covers the exact bytes, so read the raw body rather than parsed JSON.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const result = await processStripeEvent(event);
    if (result === "unknown_order" || result === "session_mismatch") {
      console.warn(`Stripe event ${event.id} (${event.type}): ${result}`);
    }
    return Response.json({ received: true, result });
  } catch (error) {
    // Nothing was committed, so Stripe's retry is processed from scratch.
    console.error(`Failed to process Stripe event ${event.id} (${event.type})`, error);
    return new Response("Webhook handler failed", { status: 500 });
  }
}
