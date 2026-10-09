// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/lib/products.test.ts)
import { describe, expect, test } from "vitest";
import {
  getBagProducts,
  getCategory,
  getCategoryProducts,
  getCategorySlugs,
  getGiftEdit,
  getHomeCategories,
  getNewArrivals,
  getProduct,
  getProductSlugs,
  getRelatedProducts,
  searchProducts,
} from "@/lib/products";
import { createCategory, createProduct } from "@tests/helpers/factories";

/** Creation dates one day apart, so "newest first" is deterministic. */
const day = (n: number) => new Date(Date.UTC(2026, 0, n));
const names = (rows: { name: string }[]) => rows.map((row) => row.name);

describe("searchProducts", () => {
  test("matches name, category and description, ignoring case", async () => {
    const coats = await createCategory({ name: "Coats" });
    await createProduct({ name: "Wool Overcoat", createdAt: day(1) });
    await createProduct({ name: "Belted Trench", categoryId: coats.id, createdAt: day(2) });
    await createProduct({ name: "Field Jacket", description: "Waxed cotton with a WOOL lining.", createdAt: day(3) });
    await createProduct({ name: "Silk Scarf", createdAt: day(4) });

    expect(names(await searchProducts("wool"))).toEqual(["Wool Overcoat", "Field Jacket"]);
    expect(names(await searchProducts("COATS"))).toEqual(["Belted Trench"]);
    expect(await searchProducts("velvet")).toEqual([]);
  });

  test("ranks name matches first, then newest", async () => {
    await createProduct({ name: "Cashmere Scarf", createdAt: day(1) });
    await createProduct({ name: "Ribbed Beanie", description: "Pure cashmere.", createdAt: day(3) });
    await createProduct({ name: "Cashmere Jumper", createdAt: day(2) });
    await createProduct({ name: "Knit Gloves", description: "Cashmere blend.", createdAt: day(4) });

    expect(names(await searchProducts("cashmere"))).toEqual([
      "Cashmere Jumper",
      "Cashmere Scarf",
      "Knit Gloves",
      "Ribbed Beanie",
    ]);
  });

  test("treats LIKE wildcards and backslashes in the query literally", async () => {
    await createProduct({ name: "100% Linen Shirt" });
    await createProduct({ name: "1000 Thread Sheets" });
    await createProduct({ name: "Style_A Tote" });
    await createProduct({ name: "StyleBA Tote" });
    await createProduct({ name: "Back\\Slash Cap" });

    expect(names(await searchProducts("100%"))).toEqual(["100% Linen Shirt"]);
    expect(names(await searchProducts("style_a"))).toEqual(["Style_A Tote"]);
    expect(names(await searchProducts("%"))).toEqual(["100% Linen Shirt"]);
    expect(names(await searchProducts("\\"))).toEqual(["Back\\Slash Cap"]);
  });

  test("respects the limit", async () => {
    for (let n = 1; n <= 5; n++) await createProduct({ name: `Tote ${n}`, createdAt: day(n) });

    expect(names(await searchProducts("tote", 2))).toEqual(["Tote 5", "Tote 4"]);
    expect(await searchProducts("tote")).toHaveLength(5);
  });

  test("returns storefront products with the category label and image", async () => {
    const bags = await createCategory({ name: "Bags" });
    const plain = await createProduct({ name: "Plain Tote", categoryId: bags.id, priceCents: 48_000 });
    await createProduct({ name: "Badged Tote", categoryId: bags.id, badge: "New" });

    const [badged, unbadged] = await searchProducts("tote");
    expect(unbadged).toEqual({
      id: plain.id,
      slug: plain.slug,
      name: "Plain Tote",
      category: "Bags",
      priceCents: 48_000,
      image: { src: plain.imageSrc, alt: plain.imageAlt },
      badge: undefined,
      stock: 10,
    });
    expect(badged.badge).toBe("New");
  });
});

describe("listing reads", () => {
  test("carry live stock for product cards, and 0 for a product without a stock row", async () => {
    const shoes = await createCategory({ name: "Shoes" });
    const low = await createProduct({ name: "Derby", categoryId: shoes.id, stock: 2, isGiftEdit: true, createdAt: day(1) });
    const none = await createProduct({ name: "Loafer", categoryId: shoes.id, stock: null, createdAt: day(2) });
    const soldOut = await createProduct({ name: "Boot", categoryId: shoes.id, stock: 0, createdAt: day(3) });
    const stock = (rows: { id: number; stock: number }[]) => rows.map(({ id, stock }) => ({ id, stock }));
    const expected = [
      { id: soldOut.id, stock: 0 },
      { id: none.id, stock: 0 },
      { id: low.id, stock: 2 },
    ];

    expect(stock(await getNewArrivals())).toEqual(expected);
    expect(stock(await getCategoryProducts(shoes.id))).toEqual(expected);
    expect(stock(await searchProducts("o"))).toEqual(expected);
    expect(stock(await getGiftEdit())).toEqual([{ id: low.id, stock: 2 }]);
    const derby = await getProduct(low.slug);
    expect(stock(await getRelatedProducts(derby!))).toEqual([expected[0], expected[1]]);
  });
});

describe("getBagProducts", () => {
  test("returns nothing for an empty list", async () => {
    await createProduct();
    expect(await getBagProducts([])).toEqual([]);
  });

  test("returns live price and stock, and leaves out unknown IDs", async () => {
    const coat = await createProduct({ name: "Coat", priceCents: 189_000, stock: 2 });
    const bag = await createProduct({ name: "Bag", priceCents: 48_000, stock: 7 });

    const rows = await getBagProducts([bag.id, 9_999, coat.id]);
    expect(rows.map(({ id, priceCents, stock }) => ({ id, priceCents, stock })).sort((a, b) => a.id - b.id)).toEqual([
      { id: coat.id, priceCents: 189_000, stock: 2 },
      { id: bag.id, priceCents: 48_000, stock: 7 },
    ]);
  });

  test("reports stock 0 for a product without a stock row", async () => {
    const product = await createProduct({ stock: null });
    const [row] = await getBagProducts([product.id]);
    expect(row.stock).toBe(0);
  });
});

describe("getProduct", () => {
  test("returns the product with its details and stock", async () => {
    const category = await createCategory({ name: "Knitwear" });
    const product = await createProduct({
      slug: "cable-knit",
      name: "Cable Knit",
      categoryId: category.id,
      description: "Chunky merino.",
      details: ["100% merino", "Made in Scotland"],
      stock: 3,
    });

    expect(await getProduct("cable-knit")).toMatchObject({
      id: product.id,
      name: "Cable Knit",
      category: "Knitwear",
      categoryId: category.id,
      description: "Chunky merino.",
      details: ["100% merino", "Made in Scotland"],
      stock: 3,
      image: { src: product.imageSrc, alt: product.imageAlt },
    });
  });

  test("reports stock 0 without a stock row", async () => {
    await createProduct({ slug: "no-stock-row", stock: null });
    expect((await getProduct("no-stock-row"))?.stock).toBe(0);
  });

  test("returns undefined for an unknown slug", async () => {
    expect(await getProduct("missing")).toBeUndefined();
  });
});

describe("getRelatedProducts", () => {
  test("lists the same category first, newest first, without the product itself", async () => {
    const coats = await createCategory();
    const bags = await createCategory();
    await createProduct({ slug: "coat-a", name: "Coat A", categoryId: coats.id, createdAt: day(1) });
    await createProduct({ name: "Coat B", categoryId: coats.id, createdAt: day(2) });
    await createProduct({ name: "Bag A", categoryId: bags.id, createdAt: day(5) });
    await createProduct({ name: "Coat C", categoryId: coats.id, createdAt: day(3) });
    await createProduct({ name: "Bag B", categoryId: bags.id, createdAt: day(4) });

    const product = await getProduct("coat-a");
    if (!product) throw new Error("coat-a missing");
    expect(names(await getRelatedProducts(product))).toEqual(["Coat C", "Coat B", "Bag A", "Bag B"]);
    expect(names(await getRelatedProducts(product, 2))).toEqual(["Coat C", "Coat B"]);
  });
});

describe("categories", () => {
  test("getCategory finds a category by slug", async () => {
    const category = await createCategory({ slug: "bags", name: "Bags", title: "Handbags" });
    expect(await getCategory("bags")).toEqual({ id: category.id, slug: "bags", name: "Bags", title: "Handbags" });
    expect(await getCategory("missing")).toBeUndefined();
  });

  test("getCategoryProducts lists only that category, newest first", async () => {
    const bags = await createCategory();
    const shoes = await createCategory();
    await createProduct({ name: "Tote", categoryId: bags.id, createdAt: day(1) });
    await createProduct({ name: "Loafer", categoryId: shoes.id, createdAt: day(2) });
    await createProduct({ name: "Clutch", categoryId: bags.id, createdAt: day(3) });

    expect(names(await getCategoryProducts(bags.id))).toEqual(["Clutch", "Tote"]);
    expect(await getCategoryProducts(9_999)).toEqual([]);
  });

  test("getHomeCategories keeps categories with an image, in grid order", async () => {
    await createCategory({ slug: "shoes", name: "Shoes", title: "Footwear", imageSrc: "https://img/shoes", imageAlt: "Loafers", position: 2 });
    await createCategory({ slug: "no-image", position: 0 });
    await createCategory({ slug: "bags", name: "Bags", title: "Handbags", imageSrc: "https://img/bags", imageAlt: "A tote", position: 1 });

    expect(await getHomeCategories()).toEqual([
      { slug: "bags", eyebrow: "Bags", title: "Handbags", image: { src: "https://img/bags", alt: "A tote" } },
      { slug: "shoes", eyebrow: "Shoes", title: "Footwear", image: { src: "https://img/shoes", alt: "Loafers" } },
    ]);
  });

  test("getHomeCategories uses an empty alt when a category has an image but no alt", async () => {
    await createCategory({ imageSrc: "https://img/x" });
    expect((await getHomeCategories())[0].image).toEqual({ src: "https://img/x", alt: "" });
  });
});

describe("collections and static params", () => {
  test("getNewArrivals lists the newest products, 8 by default", async () => {
    for (let n = 1; n <= 10; n++) await createProduct({ name: `Piece ${n}`, createdAt: day(n) });

    const arrivals = await getNewArrivals();
    expect(arrivals).toHaveLength(8);
    expect(names(arrivals).slice(0, 3)).toEqual(["Piece 10", "Piece 9", "Piece 8"]);
    expect(names(await getNewArrivals(2))).toEqual(["Piece 10", "Piece 9"]);
  });

  test("getGiftEdit lists only gift-edit products, newest first", async () => {
    await createProduct({ name: "Candle", isGiftEdit: true, createdAt: day(1) });
    await createProduct({ name: "Coat", createdAt: day(2) });
    await createProduct({ name: "Card Holder", isGiftEdit: true, createdAt: day(3) });

    expect(names(await getGiftEdit())).toEqual(["Card Holder", "Candle"]);
  });

  test("getCategorySlugs and getProductSlugs list every slug", async () => {
    const category = await createCategory({ slug: "bags" });
    await createCategory({ slug: "shoes" });
    await createProduct({ slug: "tote", categoryId: category.id });
    await createProduct({ slug: "clutch", categoryId: category.id });

    expect((await getCategorySlugs()).sort()).toEqual(["bags", "shoes"]);
    expect((await getProductSlugs()).sort()).toEqual(["clutch", "tote"]);
  });
});
