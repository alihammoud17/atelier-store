// Run with: pnpm test (or pnpm exec vitest run tests/unit/lib/redirects.test.ts)
import assert from "node:assert/strict";
import { test } from "vitest";
import { safeNext } from "@/lib/redirects";

test("safeNext keeps same-origin paths with their query and hash", () => {
  assert.equal(safeNext("/"), "/");
  assert.equal(safeNext("/account"), "/account");
  assert.equal(safeNext("/account/orders/3f1c2b9e?tab=items#total"), "/account/orders/3f1c2b9e?tab=items#total");
  assert.equal(safeNext("/search?q=wool%20coat"), "/search?q=wool%20coat");
});

test("safeNext rejects protocol-relative and absolute URLs", () => {
  for (const next of [
    "//evil.com",
    "//evil.com/account",
    "/\\evil.com",
    "/\\/evil.com",
    "https://evil.com",
    "http:/evil.com",
    "javascript:alert(1)",
    "data:text/html,hi",
  ]) {
    assert.equal(safeNext(next), "/account", next);
  }
});

test("safeNext rejects paths that browsers turn into another origin", () => {
  // URL parsers strip tabs and newlines, so "/\t/evil.com" navigates to //evil.com.
  for (const next of ["/\t/evil.com", "/\n/evil.com", "/\r\n/evil.com", "/\t\\evil.com"]) {
    assert.equal(safeNext(next), "/account", JSON.stringify(next));
  }
});

test("safeNext rejects relative paths, empty values and non-strings", () => {
  for (const next of ["account", "", " /account", "?next=/x", undefined, null, 42, ["/account"], { href: "/" }]) {
    assert.equal(safeNext(next), "/account", JSON.stringify(next));
  }
});

test("safeNext uses the given fallback", () => {
  assert.equal(safeNext("//evil.com", "/"), "/");
  assert.equal(safeNext(undefined, "/bag"), "/bag");
});
