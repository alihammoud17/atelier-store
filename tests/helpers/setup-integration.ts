import { afterAll, beforeEach, vi } from "vitest";
import { closeDb, resetDb } from "./db";
import { testCookies } from "./next-headers";
import { resetStripeMock } from "./stripe";

// Loaded before every integration test file (vitest.config.ts). Request cookies and Stripe
// are replaced at the module boundary; everything else, including Postgres, is real.
vi.mock("next/headers", () => import("./next-headers"));
vi.mock("@/lib/stripe", () => import("./stripe"));

// Each test starts from an empty database, no cookies and unstubbed Stripe calls.
beforeEach(async () => {
  await resetDb();
  testCookies.reset();
  resetStripeMock();
});

afterAll(closeDb);
