import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";

// The test database URL: DATABASE_URL from the shell (CI), else from `.env.test`. `.env` is
// never read. Other variables are fixed dummies set in vitest.config.mts.

export function testDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const file = resolve(import.meta.dirname, "../../.env.test");
  return existsSync(file) ? parse(readFileSync(file)).DATABASE_URL : undefined;
}

/** Throws unless the URL points at a database whose name ends in `_test`. */
export function assertTestDatabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error("DATABASE_URL is not set for tests. Copy .env.test.example to .env.test.");
  }
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests against database "${name}": its name must end in "_test".`,
    );
  }
  return url;
}
