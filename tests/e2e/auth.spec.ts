// Run with: pnpm test:e2e (or pnpm exec playwright test tests/e2e/auth.spec.ts)
import { expect, newCustomer, signIn, signUp, test } from "./helpers";

test("sign up, see the account, sign out", async ({ page }) => {
  const customer = await signUp(page);
  await expect(page.getByRole("heading", { name: `Hello, ${customer.name}` })).toBeVisible();
  await expect(page.getByText(customer.email)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/account");
  await expect(page).toHaveURL("/sign-in?next=%2Faccount");
});

test("sign in returns to the page that asked for it", async ({ page, context }) => {
  const customer = await signUp(page);
  await context.clearCookies();

  await page.goto("/account");
  await expect(page).toHaveURL("/sign-in?next=%2Faccount");
  await signIn(page, { ...customer, password: "wrong-password" });
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That email and password don't match our records.");

  await signIn(page, customer);
  await expect(page).toHaveURL("/account");
});

test("a crafted ?next= can't send a customer to another site", async ({ page, context }) => {
  const customer = await signUp(page);
  await context.clearCookies();

  for (const next of ["//evil.example", "/%09/evil.example", "/.//evil.example"]) {
    await page.goto(`/sign-in?next=${next}`);
    await signIn(page, customer);
    await expect(page).toHaveURL("/account");
    await context.clearCookies();
  }
});

test("signed-out visitors are sent to sign-in from protected pages", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL("/sign-in?next=%2Fadmin");
  await page.goto("/account/orders/3f1c2b9e-8f44-4d7a-9a8e-1b2c3d4e5f60");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Forders%2F/);
});

test("customers get a 404 from the admin area", async ({ page }) => {
  await signUp(page, newCustomer());
  for (const path of ["/admin", "/admin/products", "/admin/orders"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});

test("repeated failed sign-ins are rate limited", async ({ page }) => {
  const customer = await signUp(page);
  await page.context().clearCookies();
  await page.goto("/sign-in");

  const alert = page.getByRole("main").getByRole("alert");
  for (let attempt = 1; attempt <= 3; attempt++) {
    await signIn(page, { ...customer, password: `wrong-password-${attempt}` });
    await expect(alert).toHaveText("That email and password don't match our records.");
  }
  await signIn(page, customer);
  await expect(alert).toHaveText("Too many attempts. Please wait a minute and try again.");
  await expect(page).toHaveURL("/sign-in");
});
