// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/app/bag/actions.test.ts)
import { describe, expect, test } from "vitest";
import { addToBag, removeFromBag, updateBagQuantity } from "@/app/bag/actions";
import { BAG_COOKIE, MAX_BAG_LINES, MAX_LINE_QUANTITY } from "@/lib/bag";
import { createProduct } from "@tests/helpers/factories";
import { testCookies } from "@tests/helpers/next-headers";

const bagCookie = () => testCookies.value(BAG_COOKIE);
const seedBag = (value: string) => testCookies.seed({ [BAG_COOKIE]: value });

// Server actions are public endpoints, so they get anything a client can send.
const invalidIds: unknown[] = ["abc", "", " 7", "1e3", "0x10", "1.5", 1.5, 0, -1, "-1", NaN, Infinity, 2 ** 53, null, undefined, {}, [1], true];

describe("addToBag", () => {
  test("adds a new line with quantity 1 at the end of the bag", async () => {
    const tote = await createProduct({ stock: 5 });
    seedBag("9001:2");

    expect(await addToBag(tote.id)).toEqual({ ok: true, message: "Added to your bag.", quantity: 1 });
    expect(bagCookie()).toBe(`9001:2,${tote.id}:1`);
  });

  test("accepts the product ID as a form string", async () => {
    const tote = await createProduct({ stock: 5 });
    expect((await addToBag(String(tote.id)))?.ok).toBe(true);
    expect(bagCookie()).toBe(`${tote.id}:1`);
  });

  test("increments an existing line", async () => {
    const tote = await createProduct({ stock: 5 });
    seedBag(`${tote.id}:2`);

    expect(await addToBag(tote.id)).toEqual({ ok: true, message: "Added to your bag.", quantity: 3 });
    expect(bagCookie()).toBe(`${tote.id}:3`);
  });

  test.each(invalidIds)("rejects the invalid product ID %j without touching the bag", async (input) => {
    seedBag("9001:1");
    expect(await addToBag(input)).toEqual({ ok: false, message: "This piece is no longer available." });
    expect(bagCookie()).toBe("9001:1");
  });

  test("rejects an unknown product", async () => {
    expect(await addToBag(9_999)).toEqual({ ok: false, message: "This piece is no longer available." });
    expect(bagCookie()).toBeUndefined();
  });

  test("rejects a sold-out product, including one without a stock row", async () => {
    const soldOut = await createProduct({ stock: 0 });
    const noStockRow = await createProduct({ stock: null });

    expect(await addToBag(soldOut.id)).toEqual({ ok: false, message: "This piece is sold out." });
    expect(await addToBag(noStockRow.id)).toEqual({ ok: false, message: "This piece is sold out." });
    expect(bagCookie()).toBeUndefined();
  });

  test("stops at the stock level", async () => {
    const scarf = await createProduct({ stock: 2 });
    seedBag(`${scarf.id}:2`);

    expect(await addToBag(scarf.id)).toEqual({
      ok: false,
      message: "You already have all 2 pieces in your bag.",
      quantity: 2,
    });
    expect(bagCookie()).toBe(`${scarf.id}:2`);
  });

  test("uses the singular for a single piece", async () => {
    const scarf = await createProduct({ stock: 1 });
    seedBag(`${scarf.id}:1`);
    expect((await addToBag(scarf.id))?.message).toBe("You already have all 1 piece in your bag.");
  });

  test("fixes up a stale cookie that holds more than is in stock", async () => {
    const scarf = await createProduct({ stock: 2 });
    seedBag(`9001:1,${scarf.id}:6`);

    expect(await addToBag(scarf.id)).toMatchObject({ ok: false, quantity: 2 });
    expect(bagCookie()).toBe(`9001:1,${scarf.id}:2`);
  });

  test("refuses a new line once the bag holds MAX_BAG_LINES lines", async () => {
    const tote = await createProduct({ stock: 5 });
    const full = Array.from({ length: MAX_BAG_LINES }, (_, i) => `${10_000 + i}:1`).join(",");
    seedBag(full);

    expect(await addToBag(tote.id)).toEqual({ ok: false, message: "Your bag is full. Remove a piece to add another." });
    expect(bagCookie()).toBe(full);
  });

  test("still increments an existing line when the bag is full", async () => {
    const tote = await createProduct({ stock: 5 });
    const others = Array.from({ length: MAX_BAG_LINES - 1 }, (_, i) => `${10_000 + i}:1`);
    seedBag([...others, `${tote.id}:1`].join(","));

    expect(await addToBag(tote.id)).toMatchObject({ ok: true, quantity: 2 });
    expect(bagCookie()?.endsWith(`,${tote.id}:2`)).toBe(true);
  });
});

describe("updateBagQuantity", () => {
  test("sets the quantity of a line", async () => {
    const tote = await createProduct({ stock: 5 });
    seedBag(`${tote.id}:1,9001:1`);

    expect(await updateBagQuantity(tote.id, 4)).toEqual({ ok: true, message: "Quantity updated.", quantity: 4 });
    expect(bagCookie()).toBe(`${tote.id}:4,9001:1`);
  });

  test("accepts form strings", async () => {
    const tote = await createProduct({ stock: 5 });
    seedBag(`${tote.id}:1`);

    expect((await updateBagQuantity(String(tote.id), "3"))?.quantity).toBe(3);
    expect(bagCookie()).toBe(`${tote.id}:3`);
  });

  test("clamps to stock and says how many are available", async () => {
    const scarf = await createProduct({ stock: 3 });
    const single = await createProduct({ stock: 1 });
    seedBag(`${scarf.id}:1,${single.id}:1`);

    expect(await updateBagQuantity(scarf.id, 10)).toEqual({ ok: false, message: "Only 3 pieces available.", quantity: 3 });
    expect(await updateBagQuantity(single.id, 2)).toEqual({ ok: false, message: "Only 1 piece available.", quantity: 1 });
    expect(bagCookie()).toBe(`${scarf.id}:3,${single.id}:1`);
  });

  test("0 removes the line, and the last removal deletes the cookie", async () => {
    const tote = await createProduct({ stock: 5 });
    const scarf = await createProduct({ stock: 5 });
    seedBag(`${tote.id}:2,${scarf.id}:1`);

    expect(await updateBagQuantity(tote.id, 0)).toEqual({ ok: true, message: "Removed from your bag.", quantity: 0 });
    expect(bagCookie()).toBe(`${scarf.id}:1`);
    await updateBagQuantity(scarf.id, "0");
    expect(bagCookie()).toBeUndefined();
  });

  test("removes a line whose product sold out or no longer exists", async () => {
    const soldOut = await createProduct({ stock: 0 });
    seedBag(`${soldOut.id}:2,9001:1,9002:1`);

    expect(await updateBagQuantity(soldOut.id, 1)).toEqual({
      ok: false,
      message: "This piece is sold out and was removed.",
      quantity: 0,
    });
    expect(await updateBagQuantity(9001, 1)).toMatchObject({ ok: false, quantity: 0 });
    expect(bagCookie()).toBe("9002:1");
  });

  test("rejects a line that isn't in the bag", async () => {
    const tote = await createProduct({ stock: 5 });
    seedBag("9001:1");

    expect(await updateBagQuantity(tote.id, 2)).toEqual({ ok: false, message: "This piece is no longer in your bag." });
    expect(bagCookie()).toBe("9001:1");
  });

  test.each(invalidIds)("rejects the invalid product ID %j", async (input) => {
    seedBag("9001:1");
    expect(await updateBagQuantity(input, 1)).toEqual({ ok: false, message: "Enter a valid quantity." });
    expect(bagCookie()).toBe("9001:1");
  });

  test.each(["abc", "", " ", " 2", "1.5", "1e3", "0x10", 1.5, -1, "-1", NaN, Infinity, null, undefined, {}, [2]])(
    "rejects the invalid quantity %j",
    async (input) => {
      const tote = await createProduct({ stock: 5 });
      seedBag(`${tote.id}:1`);
      expect(await updateBagQuantity(tote.id, input)).toEqual({ ok: false, message: "Enter a valid quantity." });
      expect(bagCookie()).toBe(`${tote.id}:1`);
    },
  );

  test("never writes a quantity the cookie can't hold", async () => {
    // Cookie lines hold at most 4 digits. With deep stock, a large quantity must be capped
    // rather than written and then silently dropped on the next read.
    const basics = await createProduct({ stock: 50_000 });
    seedBag(`${basics.id}:1`);

    const result = await updateBagQuantity(basics.id, 20_000);
    expect(result).toEqual({ ok: false, message: `Only ${MAX_LINE_QUANTITY} pieces available.`, quantity: MAX_LINE_QUANTITY });
    expect(bagCookie()).toBe(`${basics.id}:${MAX_LINE_QUANTITY}`);
  });
});

describe("quantity cap", () => {
  test("addToBag stops at MAX_LINE_QUANTITY even with deeper stock", async () => {
    const basics = await createProduct({ stock: 50_000 });
    seedBag(`${basics.id}:${MAX_LINE_QUANTITY}`);

    expect(await addToBag(basics.id)).toMatchObject({ ok: false, quantity: MAX_LINE_QUANTITY });
    expect(bagCookie()).toBe(`${basics.id}:${MAX_LINE_QUANTITY}`);
  });
});

describe("removeFromBag", () => {
  test("removes the line and keeps the rest in order", async () => {
    seedBag("9001:1,9002:3,9003:1");

    expect(await removeFromBag(9002)).toEqual({ ok: true, message: "Removed from your bag.", quantity: 0 });
    expect(bagCookie()).toBe("9001:1,9003:1");
  });

  test("works for a product that no longer exists, and deletes the cookie when empty", async () => {
    seedBag("9001:1");
    expect((await removeFromBag("9001"))?.ok).toBe(true);
    expect(bagCookie()).toBeUndefined();
  });

  test("is a no-op for a product that isn't in the bag", async () => {
    seedBag("9001:1");
    expect((await removeFromBag(9002))?.ok).toBe(true);
    expect(bagCookie()).toBe("9001:1");
  });

  test.each(invalidIds)("rejects the invalid product ID %j without touching the bag", async (input) => {
    seedBag("9001:1");
    expect(await removeFromBag(input)).toEqual({ ok: false, message: "This piece is no longer in your bag." });
    expect(bagCookie()).toBe("9001:1");
  });
});
