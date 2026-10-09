// Run with: pnpm test:e2e (or pnpm exec playwright test tests/e2e/shopping.spec.ts)
import { bagLink, expect, test } from "./helpers";

test("browse to a product, fill the bag, change the quantity and empty it", async ({ page }) => {
  await page.goto("/collections/new-in");
  await page.getByRole("link", { name: /Round Metal Sunglasses/ }).first().click();
  await expect(page).toHaveURL("/products/round-metal-sunglasses");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Round Metal Sunglasses");
  await expect(bagLink(page)).toHaveAccessibleName("Shopping bag");

  const add = page.getByRole("button", { name: "Add to bag" });
  await add.click();
  await expect(page.getByText("Added to your bag.")).toBeVisible();
  await expect(bagLink(page)).toHaveAccessibleName("Shopping bag, 1 item");
  await add.click();
  await expect(bagLink(page)).toHaveAccessibleName("Shopping bag, 2 items");

  await page.getByRole("link", { name: "View bag" }).click();
  await expect(page).toHaveURL("/bag");
  const quantity = page.getByRole("group", { name: "Quantity of Round Metal Sunglasses" });
  await expect(quantity.locator("output")).toHaveText("2");
  await expect(page.getByText("$960").first()).toBeVisible();

  await page.getByRole("button", { name: "Increase quantity of Round Metal Sunglasses" }).click();
  await expect(quantity.locator("output")).toHaveText("3");
  await expect(bagLink(page)).toHaveAccessibleName("Shopping bag, 3 items");
  await expect(page.getByText("$1,440").first()).toBeVisible();

  await page.getByRole("button", { name: "Remove Round Metal Sunglasses from bag" }).click();
  await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
  await expect(bagLink(page)).toHaveAccessibleName("Shopping bag");
});

test("the bag survives a reload and stops at the stock level", async ({ page }) => {
  // Chevron Shoulder Bag is seeded with 2 in stock.
  await page.goto("/products/chevron-shoulder-bag");
  const add = page.getByRole("button", { name: "Add to bag" });
  await add.click();
  await expect(bagLink(page)).toHaveAccessibleName("Shopping bag, 1 item");
  await add.click();
  await expect(bagLink(page)).toHaveAccessibleName("Shopping bag, 2 items");
  await add.click();
  await expect(page.getByText("You already have all 2 pieces in your bag.")).toBeVisible();

  await page.goto("/bag");
  await page.reload();
  await expect(page.getByRole("button", { name: "Increase quantity of Chevron Shoulder Bag" })).toBeDisabled();
  await expect(page.getByText("Maximum available")).toBeVisible();
});

test("listings flag low and sold-out pieces, and a sold-out product can't be added", async ({ page }) => {
  const card = (name: string) => page.getByRole("article").filter({ has: page.getByRole("link", { name }) });

  await page.goto("/collections/bags");
  await expect(card("Chevron Shoulder Bag").getByText("Only 2 left")).toBeVisible();
  // In-stock pieces get no stock line.
  await expect(card("Canvas City Backpack").getByText(/in stock|left|unavailable/i)).toHaveCount(0);

  await page.goto("/collections/shoes");
  await expect(card("Suede Derby Shoe").getByText("Currently unavailable")).toBeVisible();

  await page.goto("/products/suede-derby-shoe");
  await expect(page.getByRole("button", { name: "Sold out" })).toBeDisabled();
});

test("search finds products by name", async ({ page }) => {
  await page.goto("/search?q=pearl");
  await expect(page.getByRole("link", { name: /Pearl Strand Necklace/ }).first()).toBeVisible();
});
