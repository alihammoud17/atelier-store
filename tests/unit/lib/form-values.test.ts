// Run with: pnpm test (or pnpm exec vitest run tests/unit/lib/form-values.test.ts)
import { describe, expect, test } from "vitest";
import { toInt, toPositiveInt } from "@/lib/form-values";

describe("toInt", () => {
  test("accepts safe integers and strings of plain digits", () => {
    expect(toInt(0)).toBe(0);
    expect(toInt(42)).toBe(42);
    expect(toInt("42")).toBe(42);
    expect(toInt("007")).toBe(7);
    expect(toInt(-3)).toBe(-3);
  });

  test.each(["", " ", " 7", "7 ", "1e3", "0x10", "1.5", "-1", "+1", "abc", "1234567890123456"])(
    "rejects the string %j",
    (value) => expect(toInt(value)).toBeNull(),
  );

  test.each([1.5, NaN, Infinity, 2 ** 53, null, undefined, {}, [1], true])("rejects %j", (value) =>
    expect(toInt(value)).toBeNull(),
  );
});

describe("toPositiveInt", () => {
  test("accepts positive integers only", () => {
    expect(toPositiveInt("12")).toBe(12);
    expect(toPositiveInt(1)).toBe(1);
    expect(toPositiveInt("0")).toBeNull();
    expect(toPositiveInt(-1)).toBeNull();
    expect(toPositiveInt("-3")).toBeNull();
  });
});
