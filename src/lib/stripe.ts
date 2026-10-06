import "server-only";
import Stripe from "stripe";

// Created on first use rather than at import, so `next build` doesn't need the key.
let client: Stripe | undefined;

export function getStripe() {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
    client = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
  }
  return client;
}
