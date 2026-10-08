import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_PORT, e2eServerEnv } from "./tests/e2e/env";

// E2E tests (tests/e2e): a production build of the app on port 3100, against the `_test`
// database, migrated, emptied and seeded before every run. See tests/e2e/env.ts.
// The build goes to .next like `pnpm build`; `next dev` uses .next/dev, so both can run at once.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec tsx tests/e2e/prepare.ts && pnpm build && pnpm start --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    env: e2eServerEnv(),
    // Always start fresh, so the database is prepared and a dev server is never tested by mistake.
    reuseExistingServer: false,
    timeout: 5 * 60_000,
    stdout: "pipe",
  },
});
