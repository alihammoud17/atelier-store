// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/app/admin/categories/actions.test.ts)
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "@/app/admin/categories/actions";
import { getAdminCategory } from "@/lib/admin-catalog";
import { expectAdminOnly, formData } from "@tests/helpers/admin";
import { signUpAndSignIn } from "@tests/helpers/auth";
import { createCategory, createProduct } from "@tests/helpers/factories";
import { expectRedirect } from "@tests/helpers/navigation";
import { revalidatePath } from "@tests/helpers/next-cache";

const fields = { name: "Bags", title: "Handbags", slug: "bags", position: "1" };

describe("createCategoryAction", () => {
  test("is admin-only", async () => {
    await expectAdminOnly(() => createCategoryAction(null, formData(fields)));
    expect(await db.select().from(categories)).toHaveLength(0);
  });

  test("creates the category and refreshes the storefront", async () => {
    await signUpAndSignIn({ role: "admin" });
    expect(await createCategoryAction(null, formData(fields))).toEqual({ ok: true, message: "Category “Bags” created." });
    expect(await db.select().from(categories)).toEqual([expect.objectContaining({ slug: "bags", position: 1 })]);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("returns field errors for invalid input and a taken slug", async () => {
    await signUpAndSignIn({ role: "admin" });
    expect(await createCategoryAction(null, formData({ ...fields, slug: "Bags!", position: "-1" }))).toMatchObject({
      ok: false,
      fieldErrors: { slug: expect.any(String), position: expect.any(String) },
      values: { ...fields, slug: "Bags!", position: "-1" },
    });
    await createCategory({ slug: "bags" });
    expect(await createCategoryAction(null, formData(fields))).toMatchObject({ ok: false, fieldErrors: { slug: expect.any(String) } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateCategoryAction", () => {
  test("is admin-only", async () => {
    const category = await createCategory({ slug: "original" });
    await expectAdminOnly(() => updateCategoryAction(null, formData({ ...fields, categoryId: String(category.id) })));
    expect((await getAdminCategory(category.id))?.slug).toBe("original");
  });

  test("saves the category", async () => {
    await signUpAndSignIn({ role: "admin" });
    const category = await createCategory();
    expect(await updateCategoryAction(null, formData({ ...fields, categoryId: String(category.id) }))).toEqual({
      ok: true,
      message: "Category saved.",
    });
    expect(await getAdminCategory(category.id)).toMatchObject({ slug: "bags", title: "Handbags" });
  });

  test.each(["", "0", "abc", "999999"])("rejects the tampered category ID %j", async (categoryId) => {
    await signUpAndSignIn({ role: "admin" });
    expect(await updateCategoryAction(null, formData({ ...fields, categoryId }))).toMatchObject({ ok: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteCategoryAction", () => {
  test("is admin-only", async () => {
    const category = await createCategory();
    await expectAdminOnly(() => deleteCategoryAction(null, formData({ categoryId: String(category.id) })));
    expect(await getAdminCategory(category.id)).toBeDefined();
  });

  test("deletes an empty category and returns to the list", async () => {
    await signUpAndSignIn({ role: "admin" });
    const category = await createCategory();
    expect(await expectRedirect(() => deleteCategoryAction(null, formData({ categoryId: String(category.id) })))).toBe(
      "/admin/categories?deleted=1",
    );
    expect(await db.select().from(categories).where(eq(categories.id, category.id))).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("keeps a category that still has products", async () => {
    await signUpAndSignIn({ role: "admin" });
    const product = await createProduct();
    expect(await deleteCategoryAction(null, formData({ categoryId: String(product.categoryId) }))).toEqual({
      ok: false,
      message: "Move or remove this category's products before deleting it.",
    });
    expect(await getAdminCategory(product.categoryId)).toMatchObject({ productCount: 1 });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test.each(["", "0", "-1", "abc"])("rejects the tampered category ID %j", async (categoryId) => {
    await signUpAndSignIn({ role: "admin" });
    expect(await deleteCategoryAction(null, formData({ categoryId }))).toMatchObject({ ok: false });
  });
});
