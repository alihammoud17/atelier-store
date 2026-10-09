// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/app/admin/products/actions.test.ts)
import { describe, expect, test } from "vitest";
import { db } from "@/db";
import { products } from "@/db/schema";
import { createProductAction, updateProductAction } from "@/app/admin/products/actions";
import { getAdminProduct } from "@/lib/admin-catalog";
import { expectAdminOnly, formData } from "@tests/helpers/admin";
import { signUpAndSignIn } from "@tests/helpers/auth";
import { createCategory, createProduct } from "@tests/helpers/factories";
import { expectRedirect } from "@tests/helpers/navigation";
import { revalidatePath } from "@tests/helpers/next-cache";
import { getStock } from "@tests/helpers/queries";

function productFields(categoryId: number, overrides: Record<string, string> = {}) {
  return {
    name: "Wool coat",
    slug: "wool-coat",
    categoryId: String(categoryId),
    price: "129.50",
    description: "A long coat.",
    details: "100% wool\nMade in Italy",
    imageSrc: "https://images.unsplash.com/photo-1",
    imageAlt: "A wool coat",
    stock: "4",
    ...overrides,
  };
}

describe("createProductAction", () => {
  test("is admin-only and writes nothing for visitors or customers", async () => {
    const category = await createCategory();
    await expectAdminOnly(() => createProductAction(null, formData(productFields(category.id))));
    expect(await db.select().from(products)).toHaveLength(0);
  });

  test("creates the product with its stock, refreshes the storefront and opens the edit page", async () => {
    await signUpAndSignIn({ role: "admin" });
    const category = await createCategory();

    const target = await expectRedirect(() => createProductAction(null, formData(productFields(category.id))));
    const [product] = await db.select().from(products);
    expect(target).toBe(`/admin/products/${product.id}?saved=created`);
    expect(product).toMatchObject({ slug: "wool-coat", priceCents: 12_950, details: ["100% wool", "Made in Italy"] });
    expect(await getStock(product.id)).toBe(4);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("returns field errors and the submitted values for invalid input", async () => {
    await signUpAndSignIn({ role: "admin" });
    const category = await createCategory();
    const fields = productFields(category.id, { price: "1e3", imageSrc: "https://evil.example/x.png", stock: "-1" });

    const state = await createProductAction(null, formData(fields));
    expect(state).toEqual({
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { price: expect.any(String), imageSrc: expect.any(String), stock: expect.any(String) },
      values: fields,
    });
    expect(await db.select().from(products)).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test("reports a duplicate slug and an unknown category as field errors", async () => {
    await signUpAndSignIn({ role: "admin" });
    const existing = await createProduct({ slug: "wool-coat" });

    expect(await createProductAction(null, formData(productFields(existing.categoryId)))).toMatchObject({
      ok: false,
      fieldErrors: { slug: "This slug is already used." },
    });
    expect(await createProductAction(null, formData(productFields(999_999, { slug: "other" })))).toMatchObject({
      ok: false,
      fieldErrors: { categoryId: expect.any(String) },
    });
    expect(await db.select().from(products)).toHaveLength(1);
  });
});

describe("updateProductAction", () => {
  test("is admin-only and changes nothing for visitors or customers", async () => {
    const product = await createProduct({ slug: "original" });
    await expectAdminOnly(() =>
      updateProductAction(null, formData({ ...productFields(product.categoryId), productId: String(product.id) })),
    );
    expect((await getAdminProduct(product.id))?.slug).toBe("original");
  });

  test("saves the product and refreshes the storefront, leaving stock alone", async () => {
    await signUpAndSignIn({ role: "admin" });
    const product = await createProduct({ slug: "original", stock: 7 });
    const fields = { ...productFields(product.categoryId, { slug: "renamed", price: "80", stock: "999" }), productId: String(product.id) };

    expect(await updateProductAction(null, formData(fields))).toEqual({ ok: true, message: "Product saved." });
    expect(await getAdminProduct(product.id)).toMatchObject({ slug: "renamed", priceCents: 8_000 });
    expect(await getStock(product.id)).toBe(7);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test.each(["", "0", "-1", "abc", "1.5", "999999"])("rejects the tampered product ID %j", async (productId) => {
    await signUpAndSignIn({ role: "admin" });
    const product = await createProduct({ slug: "original" });

    const state = await updateProductAction(null, formData({ ...productFields(product.categoryId), productId }));
    expect(state).toMatchObject({ ok: false, message: "This product no longer exists." });
    expect((await getAdminProduct(product.id))?.slug).toBe("original");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test("refuses another product's slug", async () => {
    await signUpAndSignIn({ role: "admin" });
    await createProduct({ slug: "taken" });
    const product = await createProduct({ slug: "mine" });

    const state = await updateProductAction(
      null,
      formData({ ...productFields(product.categoryId, { slug: "taken" }), productId: String(product.id) }),
    );
    expect(state).toMatchObject({ ok: false, fieldErrors: { slug: expect.any(String) } });
  });
});
