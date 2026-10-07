import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { defineConfig } from "vitest/config";

// Test layers (docs/plans/2026-10-06-testing-strategy.md):
// - unit:        *.test.ts      pure, client-safe helpers; no database
// - integration: *.int.test.ts  real Postgres test database, run one file at a time
// - component:   *.test.tsx     client components in jsdom
//
// Integration tests take only DATABASE_URL from the environment (the shell, else `.env.test`)
// and never read `.env`, so they can't touch the development database. Same rule as
// src/test/env.ts, which the global setup uses.
const envFile = fileURLToPath(new URL(".env.test", import.meta.url));
const databaseUrl =
  process.env.DATABASE_URL ?? (existsSync(envFile) ? parse(readFileSync(envFile)).DATABASE_URL : undefined);

// Everything else is a fixed dummy: Stripe is stubbed and webhook signatures are made locally.
// These always win over `.env.test` and the shell, so tests never pick up real keys.
const integrationEnv = {
  BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  STRIPE_SECRET_KEY: "sk_test_offline",
  STRIPE_WEBHOOK_SECRET: "whsec_test_offline",
  ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
};

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // The real package throws outside React Server Components; tests import server modules directly.
      "server-only": fileURLToPath(new URL("src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/app/**/actions.ts", "src/app/**/route.ts", "src/proxy.ts"],
      exclude: ["**/*.test.*", "src/test/**"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts"],
          env: integrationEnv,
          globalSetup: ["src/test/global-setup.ts"],
          setupFiles: ["src/test/setup-integration.ts"],
          // Every file shares one database, so files run one after another.
          fileParallelism: false,
          testTimeout: 15_000,
          hookTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["src/test/setup-component.ts"],
        },
      },
    ],
  },
});
