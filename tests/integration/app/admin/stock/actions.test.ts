// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/app/admin/stock/actions.test.ts)
import { describe, expect, test } from "vitest";
import { db } from "@/db";
import { updateStockAction } from "@/app/admin/stock/actions";
import { MAX_STOCK_QUANTITY } from "@/lib/admin-forms";
import { getStockOverview } from "@/lib/admin-catalog";
import { releaseOrder } from "@/lib/orders";
import { expectAdminOnly, formData } from "@tests/helpers/admin";
import { signUpAndSignIn } from "@tests/helpers/auth";
import { createReservedOrder } from "@tests/helpers/checkout";
import { createProduct } from "@tests/helpers/factories";
import { revalidatePath } from "@tests/helpers/next-cache";
import { getStock } from "@tests/helpers/queries";

const stockForm = (productId: number, quantity: string, expected: string) =>
  formData({ productId: String(productId), quantity, expected });

describe("updateStockAction", () => {
  test("is admin-only and leaves stock alone for visitors or customers", async () => {
    const product = await createProduct({ stock: 3 });
    await expectAdminOnly(() => updateStockAction(null, stockForm(product.id, "50", "3")));
    expect(await getStock(product.id)).toBe(3);
  });

  test("sets available stock and refreshes the storefront", async () => {
    await signUpAndSignIn({ role: "admin" });
    const product = await createProduct({ stock: 3 });

    expect(await updateStockAction(null, stockForm(product.id, "12", "3"))).toEqual({
      ok: true,
      message: "Stock set to 12 units.",
      quantity: 12,
    });
    expect(await getStock(product.id)).toBe(12);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");

    expect(await updateStockAction(null, stockForm(product.id, "0", "12"))).toMatchObject({ ok: true, quantity: 0 });
    expect(await getStock(product.id)).toBe(0);
  });

  test("refuses to overwrite stock a checkout reserved after the form was loaded", async () => {
    await signUpAndSignIn({ role: "admin" });
    const product = await createProduct({ stock: 5 });
    // The form showed 5; then a shopper reserves 2.
    await createReservedOrder([{ product, quantity: 2 }]);

    expect(await updateStockAction(null, stockForm(product.id, "20", "5"))).toEqual({
      ok: false,
      message: "Stock changed to 3 units since you loaded this page. Check it and save again.",
      quantity: 3,
    });
    expect(await getStock(product.id)).toBe(3);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test("an admin update keeps open reservations: releasing one adds its units back", async () => {
    await signUpAndSignIn({ role: "admin" });
    const product = await createProduct({ stock: 5 });
    const order = await createReservedOrder([{ product, quantity: 2 }]);
    expect(await getStockOverview(product.id)).toEqual([expect.objectContaining({ available: 3, reserved: 2 })]);

    await updateStockAction(null, stockForm(product.id, "10", "3"));
    await db.transaction((tx) => releaseOrder(tx, order.orderId, "expired"));
    expect(await getStockOverview(product.id)).toEqual([expect.objectContaining({ available: 12, reserved: 0 })]);
  });

  test.each(["-1", "1.5", "1e3", "0x10", "", String(MAX_STOCK_QUANTITY + 1)])(
    "rejects the quantity %j",
    async (quantity) => {
      await signUpAndSignIn({ role: "admin" });
      const product = await createProduct({ stock: 3 });
      expect(await updateStockAction(null, stockForm(product.id, quantity, "3"))).toEqual({
        ok: false,
        message: "Check the quantity.",
        fieldErrors: { quantity: expect.any(String) },
      });
      expect(await getStock(product.id)).toBe(3);
    },
  );

  test.each([
    { productId: "0", expected: "3" },
    { productId: "abc", expected: "3" },
    { productId: "999999", expected: "3" },
    { productId: "PRODUCT", expected: "-1" },
  ])("rejects a tampered form %j", async (fields) => {
    await signUpAndSignIn({ role: "admin" });
    const product = await createProduct({ stock: 3 });
    const productId = fields.productId === "PRODUCT" ? String(product.id) : fields.productId;
    expect(await updateStockAction(null, formData({ productId, expected: fields.expected, quantity: "9" }))).toEqual({
      ok: false,
      message: "This product no longer exists.",
    });
    expect(await getStock(product.id)).toBe(3);
  });
});
