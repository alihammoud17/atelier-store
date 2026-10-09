// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/lib/admin-catalog.test.ts)
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { db } from "@/db";
import { categories, products, productStock } from "@/db/schema";
import {
  createCategory,
  createProduct,
  deleteCategory,
  getAdminCategories,
  getAdminCategory,
  getAdminProduct,
  getAdminProducts,
  getStockOverview,
  setStock,
  updateCategory,
  updateProduct,
} from "@/lib/admin-catalog";
import type { ProductInput } from "@/lib/admin-forms";
import { releaseOrder } from "@/lib/orders";
import { createReservedOrder } from "@tests/helpers/checkout";
import * as factories from "@tests/helpers/factories";
import { getStock } from "@tests/helpers/queries";


function productInput(categoryId: number, overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: "Wool coat",
    slug: "wool-coat",
    categoryId,
    priceCents: 129_00,
    description: "A long coat.",
    details: ["100% wool"],
    imageSrc: "https://images.unsplash.com/photo-1",
    imageAlt: "A wool coat",
    badge: null,
    isGiftEdit: false,
    ...overrides,
  };
}

const categoryInput = { name: "Bags", title: "Handbags", slug: "bags", imageSrc: null, imageAlt: null, position: 1 };

describe("products", () => {
  test("createProduct inserts the product and its stock row together", async () => {
    const category = await factories.createCategory();
    const created = await createProduct({ ...productInput(category.id), stock: 4 });

    expect(created).toEqual({ ok: true, id: expect.any(Number), slug: "wool-coat" });
    if (!created.ok) return;
    expect(await getAdminProduct(created.id)).toMatchObject({ name: "Wool coat", priceCents: 129_00, details: ["100% wool"] });
    expect(await getStock(created.id)).toBe(4);
  });

  test("createProduct reports a duplicate slug as a field error and writes nothing", async () => {
    const existing = await factories.createProduct({ slug: "wool-coat" });
    const result = await createProduct({ ...productInput(existing.categoryId), stock: 2 });

    expect(result).toEqual({ ok: false, message: expect.any(String), fieldErrors: { slug: "This slug is already used." } });
    expect(await db.select().from(products)).toHaveLength(1);
  });

  test("createProduct rejects a category that doesn't exist", async () => {
    const result = await createProduct(productInput(999_999));
    expect(result).toMatchObject({ ok: false, fieldErrors: { categoryId: expect.any(String) } });
    expect(await db.select().from(productStock)).toHaveLength(0);
  });

  test("updateProduct changes the fields and returns the new slug", async () => {
    const product = await factories.createProduct();
    const other = await factories.createCategory();
    const result = await updateProduct(product.id, productInput(other.id, { slug: "renamed", priceCents: 50 }));

    expect(result).toEqual({ ok: true, slug: "renamed" });
    expect(await getAdminProduct(product.id)).toMatchObject({ slug: "renamed", categoryId: other.id, priceCents: 50 });
    // Stock isn't part of the product form.
    expect(await getStock(product.id)).toBe(10);
  });

  test("updateProduct refuses another product's slug and an unknown product", async () => {
    const taken = await factories.createProduct({ slug: "taken" });
    const product = await factories.createProduct({ slug: "mine" });

    expect(await updateProduct(product.id, productInput(product.categoryId, { slug: "taken" }))).toMatchObject({
      ok: false,
      fieldErrors: { slug: expect.any(String) },
    });
    expect((await getAdminProduct(product.id))?.slug).toBe("mine");
    expect((await getAdminProduct(taken.id))?.slug).toBe("taken");
    expect(await updateProduct(999_999, productInput(product.categoryId, { slug: "new" }))).toEqual({
      ok: false,
      message: "This product no longer exists.",
    });
  });

  test("getAdminProducts lists every product with its category and stock, newest first", async () => {
    const category = await factories.createCategory({ name: "Coats" });
    const older = await factories.createProduct({ categoryId: category.id, createdAt: new Date("2026-01-01") });
    const newer = await factories.createProduct({ categoryId: category.id, stock: null });

    expect(await getAdminProducts()).toEqual([
      expect.objectContaining({ id: newer.id, category: "Coats", stock: 0 }),
      expect.objectContaining({ id: older.id, category: "Coats", stock: 10 }),
    ]);
    expect(await getAdminProduct(999_999)).toBeUndefined();
  });
});

describe("categories", () => {
  test("create, update and list with product counts", async () => {
    const created = await createCategory(categoryInput);
    expect(created).toEqual({ ok: true, id: expect.any(Number) });
    if (!created.ok) return;
    const empty = await factories.createCategory({ position: 0 });
    await factories.createProduct({ categoryId: created.id });
    await factories.createProduct({ categoryId: created.id });

    expect(await updateCategory(created.id, { ...categoryInput, title: "Bags & totes" })).toEqual({ ok: true });
    expect(await getAdminCategories()).toEqual([
      expect.objectContaining({ id: empty.id, productCount: 0 }),
      expect.objectContaining({ id: created.id, title: "Bags & totes", productCount: 2 }),
    ]);
    expect(await getAdminCategory(created.id)).toMatchObject({ slug: "bags", productCount: 2 });
    expect(await getAdminCategory(999_999)).toBeUndefined();
  });

  test("a duplicate slug is a field error on create and update", async () => {
    await factories.createCategory({ slug: "bags" });
    const other = await factories.createCategory({ slug: "shoes" });

    expect(await createCategory(categoryInput)).toMatchObject({ ok: false, fieldErrors: { slug: expect.any(String) } });
    expect(await updateCategory(other.id, categoryInput)).toMatchObject({ ok: false, fieldErrors: { slug: expect.any(String) } });
    expect(await updateCategory(999_999, { ...categoryInput, slug: "new" })).toMatchObject({ ok: false });
  });

  test("deleteCategory removes an empty category but keeps one that still has products", async () => {
    const empty = await factories.createCategory();
    const product = await factories.createProduct();

    expect(await deleteCategory(empty.id)).toEqual({ ok: true });
    expect(await deleteCategory(product.categoryId)).toEqual({
      ok: false,
      message: "Move or remove this category's products before deleting it.",
    });
    expect(await db.select().from(categories).where(eq(categories.id, product.categoryId))).toHaveLength(1);
    expect(await deleteCategory(empty.id)).toEqual({ ok: false, message: "This category no longer exists." });
  });
});

describe("stock", () => {
  test("setStock applies when stock still holds the expected value", async () => {
    const product = await factories.createProduct({ stock: 3 });
    expect(await setStock(product.id, { quantity: 12, expected: 3 })).toEqual({ ok: true, quantity: 12 });
    expect(await getStock(product.id)).toBe(12);
  });

  test("setStock refuses a stale expected value and reports the current stock", async () => {
    const product = await factories.createProduct({ stock: 3 });
    expect(await setStock(product.id, { quantity: 12, expected: 5 })).toEqual({ ok: false, reason: "conflict", current: 3 });
    expect(await getStock(product.id)).toBe(3);
  });

  test("setStock creates a missing stock row, which the storefront reads as 0", async () => {
    const product = await factories.createProduct({ stock: null });
    expect(await setStock(product.id, { quantity: 2, expected: 1 })).toEqual({ ok: false, reason: "conflict", current: 0 });
    expect(await getStock(product.id)).toBeUndefined();
    expect(await setStock(product.id, { quantity: 2, expected: 0 })).toEqual({ ok: true, quantity: 2 });
    expect(await getStock(product.id)).toBe(2);
  });

  test("setStock reports an unknown product", async () => {
    expect(await setStock(999_999, { quantity: 1, expected: 0 })).toEqual({ ok: false, reason: "not_found" });
  });

  test("getStockOverview shows units reserved by open checkouts next to available stock", async () => {
    const coat = await factories.createProduct({ name: "Coat", stock: 5 });
    const scarf = await factories.createProduct({ name: "Scarf", stock: 2 });
    await createReservedOrder([{ product: coat, quantity: 2 }]);
    await createReservedOrder([{ product: coat, quantity: 1 }, { product: scarf, quantity: 1 }]);
    // Released and paid orders hold nothing.
    const released = await createReservedOrder([{ product: scarf, quantity: 1 }]);
    await db.transaction((tx) => releaseOrder(tx, released.orderId, "expired"));
    await factories.createOrder({ status: "paid", items: [{ product: coat, quantity: 4 }] });

    expect(await getStockOverview()).toEqual([
      expect.objectContaining({ productId: coat.id, available: 2, reserved: 3 }),
      expect.objectContaining({ productId: scarf.id, available: 1, reserved: 1 }),
    ]);
    expect(await getStockOverview(scarf.id)).toEqual([expect.objectContaining({ productId: scarf.id })]);
  });

  test("an admin update during a checkout keeps the reservation: releasing adds it back on top", async () => {
    const coat = await factories.createProduct({ stock: 5 });
    const order = await createReservedOrder([{ product: coat, quantity: 2 }]);

    // The admin counts 10 sellable units on top of what's reserved.
    expect(await setStock(coat.id, { quantity: 10, expected: 3 })).toEqual({ ok: true, quantity: 10 });
    await db.transaction((tx) => releaseOrder(tx, order.orderId, "expired"));
    expect(await getStock(coat.id)).toBe(12);
  });
});
