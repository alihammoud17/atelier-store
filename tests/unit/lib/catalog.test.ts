// Run with: pnpm test (or pnpm exec vitest run tests/unit/lib/catalog.test.ts)
import assert from "node:assert/strict";
import { test } from "vitest";
import { formatPrice, getStockStatus } from "@/lib/catalog";

test("formatPrice takes cents and shows whole US dollars", () => {
  assert.equal(formatPrice(0), "$0");
  assert.equal(formatPrice(100), "$1");
  assert.equal(formatPrice(89_000), "$890");
  assert.equal(formatPrice(245_000), "$2,450");
  assert.equal(formatPrice(123_456_700), "$1,234,567");
});

test("formatPrice rounds cents to the nearest dollar", () => {
  // Catalog prices are whole dollars; this pins what a price with cents would show.
  assert.equal(formatPrice(1_999), "$20");
  assert.equal(formatPrice(1_949), "$19");
  assert.equal(formatPrice(50), "$1");
});

test("getStockStatus: none left is sold out, 1–3 is low, 4 or more is in stock", () => {
  assert.equal(getStockStatus(-1), "out-of-stock");
  assert.equal(getStockStatus(0), "out-of-stock");
  assert.equal(getStockStatus(1), "low-stock");
  assert.equal(getStockStatus(3), "low-stock");
  assert.equal(getStockStatus(4), "in-stock");
  assert.equal(getStockStatus(250), "in-stock");
});
