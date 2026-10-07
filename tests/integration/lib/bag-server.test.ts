// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/lib/bag-server.test.ts)
import { describe, expect, test } from "vitest";
import { BAG_COOKIE } from "@/lib/bag";
import { getBag, readBag, writeBag } from "@/lib/bag-server";
import { createProduct } from "@tests/helpers/factories";
import { testCookies } from "@tests/helpers/next-headers";

describe("readBag", () => {
  test("parses the bag cookie", async () => {
    testCookies.seed({ [BAG_COOKIE]: "12:2,3:1" });
    expect(await readBag()).toEqual([
      { productId: 12, quantity: 2 },
      { productId: 3, quantity: 1 },
    ]);
  });

  test("is empty without a cookie or with a garbage one", async () => {
    expect(await readBag()).toEqual([]);
    testCookies.seed({ [BAG_COOKIE]: "<script>" });
    expect(await readBag()).toEqual([]);
  });
});

describe("writeBag", () => {
  test("stores the lines in a cookie the header badge can read", async () => {
    await writeBag([
      { productId: 4, quantity: 2 },
      { productId: 9, quantity: 1 },
    ]);
    expect(testCookies.value(BAG_COOKIE)).toBe("4:2,9:1");
    expect(testCookies.options(BAG_COOKIE)).toEqual({
      path: "/",
      sameSite: "lax",
      secure: false, // only true when NODE_ENV is production
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 30,
    });
  });

  test("deletes the cookie when the bag is empty", async () => {
    testCookies.seed({ [BAG_COOKIE]: "4:2" });
    await writeBag([]);
    expect(testCookies.value(BAG_COOKIE)).toBeUndefined();
  });
});

describe("getBag", () => {
  test("resolves lines against live prices, in the order they were added", async () => {
    const coat = await createProduct({ name: "Coat", priceCents: 189_000, stock: 5 });
    const tote = await createProduct({ name: "Tote", priceCents: 48_000, stock: 5 });
    testCookies.seed({ [BAG_COOKIE]: `${tote.id}:1,${coat.id}:2` });

    const bag = await getBag();
    expect(bag.items.map(({ name, quantity, requested, lineTotalCents }) => ({ name, quantity, requested, lineTotalCents }))).toEqual([
      { name: "Tote", quantity: 1, requested: 1, lineTotalCents: 48_000 },
      { name: "Coat", quantity: 2, requested: 2, lineTotalCents: 378_000 },
    ]);
    expect(bag.subtotalCents).toBe(426_000);
  });

  test("clamps quantities to stock but keeps what was requested", async () => {
    const scarf = await createProduct({ priceCents: 10_000, stock: 2 });
    const soldOut = await createProduct({ priceCents: 5_000, stock: 0 });
    testCookies.seed({ [BAG_COOKIE]: `${scarf.id}:5,${soldOut.id}:1` });

    const { items, subtotalCents } = await getBag();
    expect(items.map(({ id, quantity, requested, stock, lineTotalCents }) => ({ id, quantity, requested, stock, lineTotalCents }))).toEqual([
      { id: scarf.id, quantity: 2, requested: 5, stock: 2, lineTotalCents: 20_000 },
      { id: soldOut.id, quantity: 0, requested: 1, stock: 0, lineTotalCents: 0 },
    ]);
    expect(subtotalCents).toBe(20_000);
  });

  test("drops products that no longer exist", async () => {
    const tote = await createProduct({ stock: 3 });
    testCookies.seed({ [BAG_COOKIE]: `9999:1,${tote.id}:1` });

    const { items } = await getBag();
    expect(items.map((item) => item.id)).toEqual([tote.id]);
  });

  test("is empty without a cookie", async () => {
    expect(await getBag()).toEqual({ items: [], subtotalCents: 0 });
  });

  test("never reads prices from the cookie", async () => {
    const tote = await createProduct({ priceCents: 48_000, stock: 3 });
    // A tampered cookie with extra fields doesn't parse, so it can't carry a price.
    testCookies.seed({ [BAG_COOKIE]: `${tote.id}:1:1` });
    expect((await getBag()).items).toEqual([]);

    testCookies.seed({ [BAG_COOKIE]: `${tote.id}:1` });
    expect((await getBag()).items[0].priceCents).toBe(48_000);
  });
});
