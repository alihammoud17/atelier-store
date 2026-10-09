import { afterAll, beforeEach, vi } from "vitest";
import { closeDb, resetDb } from "./db";
import { resetNextCacheMock } from "./next-cache";
import { testCookies } from "./next-headers";
import { resetStripeMock } from "./stripe";

// Loaded before every integration test file (vitest.config.ts). Request cookies, cache
// revalidation and Stripe are replaced at the module boundary; everything else, including
// Postgres, is real.
vi.mock("next/headers", () => import("./next-headers"));
vi.mock("next/cache", () => import("./next-cache"));
vi.mock("@/lib/stripe", () => import("./stripe"));

// Each test starts from an empty database, no cookies, fresh cache spies and unstubbed Stripe calls.
beforeEach(async () => {
  await resetDb();
  testCookies.reset();
  resetNextCacheMock();
  resetStripeMock();
});

afterAll(closeDb);
