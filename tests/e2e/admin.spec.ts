// Run with: pnpm test:e2e (or pnpm exec playwright test tests/e2e/admin.spec.ts)
import { randomBytes } from "node:crypto";
import { expect, signUpAdmin, test } from "./helpers";

test("an admin adds a category and a product, reprices it, sells it out and checks orders", async ({ page }) => {
  const suffix = randomBytes(3).toString("hex");
  const category = { name: `Knitwear ${suffix}`, slug: `knitwear-${suffix}` };
  const product = { name: `Cable Knit Jumper ${suffix}`, slug: `cable-knit-jumper-${suffix}` };
  await signUpAdmin(page);

  // Category
  await page.goto("/admin/categories");
  const categoryForm = page.locator("form", { has: page.getByRole("button", { name: "Create category" }) });
  await categoryForm.getByLabel("Name", { exact: true }).fill(category.name);
  await categoryForm.getByLabel("Title", { exact: true }).fill("Knitwear for the cold months");
  await categoryForm.getByLabel("URL slug", { exact: true }).fill(category.slug);
  await categoryForm.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByText(`Category “${category.name}” created.`)).toBeVisible();
  await expect(page.getByRole("link", { name: category.name })).toBeVisible();

  // Product, with a validation error first
  await page.goto("/admin/products/new");
  await page.getByLabel("Name", { exact: true }).fill(product.name);
  await page.getByLabel("URL slug", { exact: true }).fill(product.slug);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: category.name });
  await page.getByLabel("Price (USD)").fill("245.999");
  await page.getByLabel("Description", { exact: true }).fill("A chunky cable-knit jumper in undyed wool.");
  await page.getByLabel("Details", { exact: true }).fill("100% wool\nHand wash cold");
  await page.getByLabel("Image URL").fill("https://images.unsplash.com/photo-1434389677669-e08b4cac3105");
  await page.getByLabel("Image description").fill("Cream cable-knit jumper folded on a chair");
  await page.getByLabel("Initial stock").fill("2");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByLabel("Price (USD)")).toHaveAttribute("aria-invalid", "true");
  // What was typed survives the error.
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(product.name);
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue(/\d+/);

  await page.getByLabel("Price (USD)").fill("245");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page).toHaveURL(/\/admin\/products\/\d+\?saved=created$/);
  await expect(page.getByText("Product created.")).toBeVisible();
  const editUrl = page.url().replace(/\?.*$/, "");

  // Live in the store
  await page.goto(`/products/${product.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(product.name);
  await expect(page.getByRole("main").getByText("$245").first()).toBeVisible();
  await expect(page.getByText("Only 2 left")).toBeVisible();

  // Reprice
  await page.goto(editUrl);
  await page.getByLabel("Price (USD)").fill("199");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page.getByText("Product saved.")).toBeVisible();
  await page.goto(`/products/${product.slug}`);
  await expect(page.getByRole("main").getByText("$199").first()).toBeVisible();

  // Sell out
  await page.goto(editUrl);
  await page.getByLabel(`Available stock for ${product.name}`).fill("0");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Stock set to 0 units.")).toBeVisible();
  await page.goto(`/products/${product.slug}`);
  await expect(page.getByText("Currently unavailable")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sold out" })).toBeDisabled();

  // Stock and orders
  await page.goto("/admin/stock");
  await expect(page.getByLabel(`Available stock for ${product.name}`)).toHaveValue("0");
  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Orders" }).click();
  await expect(page).toHaveURL("/admin/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
});
