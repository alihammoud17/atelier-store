import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";

// Settings shared by playwright.config.ts (the app server) and the specs. Like the Vitest
// tests, E2E runs never read `.env`: the database comes from the shell or `.env.test`, and
// everything else is fixed here, so the server can't pick up real keys by accident.

// Playwright loads this file as CommonJS, so __dirname rather than import.meta.
const file = resolve(__dirname, "../../.env.test");
const fileEnv = existsSync(file) ? parse(readFileSync(file)) : {};
const fromEnv = (name: string): string | undefined => process.env[name] || fileEnv[name] || undefined;

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/** The webhook route verifies with this secret; specs sign their events with it. */
export const E2E_WEBHOOK_SECRET = "whsec_e2e_offline";

/**
 * Opt-in Stripe sandbox key (sk_test_… or rk_test_…) for the checkout flow, which creates a
 * real Checkout Session. Without it that spec is skipped and the server gets a dummy key.
 */
export const E2E_STRIPE_SECRET_KEY = fromEnv("E2E_STRIPE_SECRET_KEY");

export function e2eDatabaseUrl() {
  const url = fromEnv("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is not set for E2E tests. Copy .env.test.example to .env.test.");
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to run E2E tests against database "${name}": its name must end in "_test".`);
  }
  if (E2E_STRIPE_SECRET_KEY && !/^(sk|rk)_test_/.test(E2E_STRIPE_SECRET_KEY)) {
    throw new Error("E2E_STRIPE_SECRET_KEY must be a Stripe test-mode key (sk_test_… or rk_test_…).");
  }
  return url;
}

/** Environment for `next build` and `next start`. */
export function e2eServerEnv() {
  return {
    NODE_ENV: "production",
    DATABASE_URL: e2eDatabaseUrl(),
    BETTER_AUTH_SECRET: "e2e-secret-at-least-32-characters-long",
    BETTER_AUTH_URL: E2E_BASE_URL,
    NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
    STRIPE_SECRET_KEY: E2E_STRIPE_SECRET_KEY ?? "sk_test_offline",
    STRIPE_WEBHOOK_SECRET: E2E_WEBHOOK_SECRET,
  };
}
