// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/app/admin/pages.test.ts)
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import AdminCategoryPage from "@/app/admin/categories/[categoryId]/page";
import AdminCategoriesPage from "@/app/admin/categories/page";
import AdminLayout from "@/app/admin/layout";
import AdminOrderPage from "@/app/admin/orders/[orderId]/page";
import AdminOrdersPage from "@/app/admin/orders/page";
import AdminPage from "@/app/admin/page";
import AdminProductPage from "@/app/admin/products/[productId]/page";
import NewProductPage from "@/app/admin/products/new/page";
import AdminProductsPage from "@/app/admin/products/page";
import AdminStockPage from "@/app/admin/stock/page";
import { signUpAndSignIn } from "@tests/helpers/auth";
import { createOrder, createProduct, createUser } from "@tests/helpers/factories";
import { expectNotFound, expectRedirect } from "@tests/helpers/navigation";

// Every admin page checks the role itself; the layout's check is only a convenience.

type Page = (props: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string>> }) => Promise<ReactElement>;

const props = (params: Record<string, string> = {}, searchParams: Record<string, string> = {}) => ({
  params: Promise.resolve(params),
  searchParams: Promise.resolve(searchParams),
});

/** A product, and a paid order for it placed by another customer. */
async function fixtures() {
  const customer = await createUser({ name: "Other Customer" });
  const product = await createProduct({ name: "Wool coat", stock: 4 });
  const order = await createOrder({ userId: customer.id, status: "paid", items: [{ product, quantity: 2 }] });
  return { product, order };
}

function pages({ product, order }: Awaited<ReturnType<typeof fixtures>>): [string, () => Promise<ReactElement>][] {
  const call = (Page: unknown, params?: Record<string, string>) => () => (Page as Page)(props(params));
  return [
    ["/admin", call(AdminPage)],
    ["/admin/products", call(AdminProductsPage)],
    ["/admin/products/new", call(NewProductPage)],
    ["/admin/products/[productId]", call(AdminProductPage, { productId: String(product.id) })],
    ["/admin/categories", call(AdminCategoriesPage)],
    ["/admin/categories/[categoryId]", call(AdminCategoryPage, { categoryId: String(product.categoryId) })],
    ["/admin/stock", call(AdminStockPage)],
    ["/admin/orders", call(AdminOrdersPage)],
    ["/admin/orders/[orderId]", call(AdminOrderPage, { orderId: order.id })],
    ["admin layout", () => AdminLayout({ children: null } as never)],
  ];
}

describe("admin pages", () => {
  test("send signed-out visitors to sign-in", async () => {
    for (const [route, render] of pages(await fixtures())) {
      expect(await expectRedirect(render), route).toBe("/sign-in?next=%2Fadmin");
    }
  });

  test("are a 404 for customers, even with valid IDs", async () => {
    const data = await fixtures();
    await signUpAndSignIn();
    for (const [, render] of pages(data)) await expectNotFound(render);
  });

  test("render for admins", async () => {
    const data = await fixtures();
    await signUpAndSignIn({ role: "admin" });
    for (const [route, render] of pages(data)) {
      if (route === "admin layout") continue; // Its nav needs the router; its guard is tested above.
      expect(renderToStaticMarkup(await render()), route).toContain("<h1");
    }
  });

  test("admins see the catalog, stock and other customers' orders", async () => {
    const { product, order } = await fixtures();
    await signUpAndSignIn({ role: "admin" });

    expect(renderToStaticMarkup(await (AdminProductsPage as Page)(props()))).toContain("Wool coat");
    expect(renderToStaticMarkup(await (AdminStockPage as Page)(props()))).toContain(`value="4"`);
    const orderHtml = renderToStaticMarkup(await (AdminOrderPage as Page)(props({ orderId: order.id })));
    expect(orderHtml).toContain("Other Customer");
    expect(orderHtml).toContain(`/admin/products/${product.id}`);
  });

  test.each([
    ["/admin/products/[productId]", AdminProductPage, { productId: "999999" }],
    ["/admin/products/[productId]", AdminProductPage, { productId: "abc" }],
    ["/admin/categories/[categoryId]", AdminCategoryPage, { categoryId: "0" }],
    ["/admin/orders/[orderId]", AdminOrderPage, { orderId: "not-a-uuid" }],
  ])("%s is a 404 for an unknown or malformed ID (%j)", async (_, Page, params) => {
    await signUpAndSignIn({ role: "admin" });
    await expectNotFound(() => (Page as unknown as Page)(props(params)));
  });

  test("the orders page ignores an unknown status filter", async () => {
    const { order } = await fixtures();
    await signUpAndSignIn({ role: "admin" });
    const html = renderToStaticMarkup(await (AdminOrdersPage as Page)(props({}, { status: "'; drop table orders; --" })));
    expect(html).toContain(`/admin/orders/${order.id}`);
  });
});
