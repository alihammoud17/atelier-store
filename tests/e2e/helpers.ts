import { randomBytes, randomInt } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every test gets its own client IP. Better Auth rate-limits sign-up and sign-in per IP
 * (3 per 10 s in production builds), and parallel tests would otherwise all share 127.0.0.1.
 * Behind a proxy (e.g. Vercel) the IP comes from X-Forwarded-For in the same way.
 */
export const test = base.extend({
  // Playwright's fixture callback, named so the React hooks lint rule doesn't mistake it for use().
  context: async ({ context }, provide) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}` });
    await provide(context);
  },
});
export { expect };

/** A unique customer per test, so specs can run in parallel against one database. */
export function newCustomer(name = "Ada Lovelace") {
  return { name, email: `e2e-${randomBytes(6).toString("hex")}@example.com`, password: "correct-horse-battery" };
}

/** The sign-in/sign-up form, not the footer's newsletter form (which also has an email field). */
const authForm = (page: Page) => page.getByRole("main").locator("form");

export async function signUp(page: Page, customer = newCustomer(), next?: string) {
  await page.goto(next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up");
  const form = authForm(page);
  await form.getByLabel("Name", { exact: true }).fill(customer.name);
  await form.getByLabel("Email", { exact: true }).fill(customer.email);
  await form.getByLabel("Password", { exact: true }).fill(customer.password);
  await form.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(next ?? "/account");
  return customer;
}

export async function signIn(page: Page, customer: { email: string; password: string }) {
  const form = authForm(page);
  await form.getByLabel("Email", { exact: true }).fill(customer.email);
  await form.getByLabel("Password", { exact: true }).fill(customer.password);
  await form.getByRole("button", { name: "Sign in" }).click();
}

/** The header's bag link, whose accessible name carries the item count. */
export const bagLink = (page: Page) => page.getByRole("banner").getByRole("link", { name: /^Shopping bag/ });
