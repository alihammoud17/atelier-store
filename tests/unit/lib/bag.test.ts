// Run with: pnpm test (or pnpm exec vitest run tests/unit/lib/bag.test.ts)
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  BAG_COOKIE,
  MAX_BAG_LINES,
  countItems,
  parseBag,
  readBagCookie,
  serializeBag,
  subtotalCents,
} from "@/lib/bag";

test("parseBag round-trips serializeBag", () => {
  const lines = [
    { productId: 12, quantity: 2 },
    { productId: 3, quantity: 1 },
  ];
  assert.equal(serializeBag(lines), "12:2,3:1");
  assert.deepEqual(parseBag(serializeBag(lines)), lines);
});

test("parseBag returns an empty bag for missing or garbage input", () => {
  assert.deepEqual(parseBag(undefined), []);
  assert.deepEqual(parseBag(""), []);
  assert.deepEqual(parseBag("not-a-bag"), []);
  assert.deepEqual(parseBag('[{"productId":1,"quantity":2}]'), []);
});

test("parseBag drops malformed, zero, negative and fractional entries", () => {
  assert.deepEqual(parseBag("1:0,2:-1,3:1.5,x:2,4:,:3,5:2"), [{ productId: 5, quantity: 2 }]);
  assert.deepEqual(parseBag("0:1"), []);
});

test("parseBag keeps the first line for a duplicated product", () => {
  assert.deepEqual(parseBag("7:1,7:5"), [{ productId: 7, quantity: 1 }]);
});

test("parseBag caps the number of lines and the size of numbers", () => {
  const many = Array.from({ length: MAX_BAG_LINES + 10 }, (_, i) => `${i + 1}:1`).join(",");
  assert.equal(parseBag(many).length, MAX_BAG_LINES);
  assert.deepEqual(parseBag("1:99999,9999999999:1"), []);
});

test("countItems and subtotalCents sum quantities and integer cents", () => {
  assert.equal(countItems([{ quantity: 2 }, { quantity: 3 }]), 5);
  assert.equal(countItems([]), 0);
  assert.equal(subtotalCents([{ lineTotalCents: 189000 * 2 }, { lineTotalCents: 48000 }]), 426000);
  assert.equal(subtotalCents([]), 0);
});

test("readBagCookie finds and decodes the bag among other cookies", () => {
  const header = `theme=light; ${BAG_COOKIE}=12%3A2%2C3%3A1; other=x`;
  assert.equal(readBagCookie(header), "12:2,3:1");
  assert.equal(readBagCookie("theme=light"), "");
  assert.equal(readBagCookie(`${BAG_COOKIE}=%E0%A4%A`), "");
});
