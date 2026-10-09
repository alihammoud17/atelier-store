// Run with: pnpm test (or pnpm exec vitest run tests/unit/components/admin/product-form.test.tsx)
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createProductAction, updateProductAction } from "@/app/admin/products/actions";
import { ProductForm, type ProductFormProduct } from "@/components/admin/product-form";

vi.mock("@/app/admin/products/actions", () => ({ createProductAction: vi.fn(), updateProductAction: vi.fn() }));
const create = vi.mocked(createProductAction);
const update = vi.mocked(updateProductAction);

afterEach(() => {
  create.mockReset();
  update.mockReset();
});

const categories = [
  { id: 1, name: "Coats" },
  { id: 2, name: "Bags" },
];

const product: ProductFormProduct = {
  id: 7,
  name: "Wool coat",
  slug: "wool-coat",
  categoryId: 2,
  priceCents: 12_950,
  description: "A long coat.",
  details: ["100% wool", "Made in Italy"],
  imageSrc: "https://images.unsplash.com/photo-1",
  imageAlt: "A wool coat",
  badge: null,
  isGiftEdit: true,
};

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

async function submit(name: RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

describe("ProductForm", () => {
  test("fills the edit form from the product, with the price in dollars", () => {
    render(<ProductForm categories={categories} product={product} />);
    expect(input("Name").value).toBe("Wool coat");
    expect(input("Price (USD)").value).toBe("129.50");
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("2");
    expect((screen.getByLabelText("Details") as HTMLTextAreaElement).value).toBe("100% wool\nMade in Italy");
    expect((screen.getByLabelText("Include in the gift edit") as HTMLInputElement).checked).toBe(true);
    // Stock is edited separately once a product exists.
    expect(screen.queryByLabelText("Initial stock")).toBeNull();
  });

  test("sends the edit to updateProductAction with the product ID", async () => {
    update.mockResolvedValue({ ok: true, message: "Product saved." });
    render(<ProductForm categories={categories} product={product} />);

    await submit(/save product/i);
    const formData = update.mock.calls[0][1];
    expect(formData.get("productId")).toBe("7");
    expect(formData.get("price")).toBe("129.50");
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Product saved.");
  });

  test("shows the action's field errors and keeps what was typed", async () => {
    create.mockResolvedValue({
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { price: "Enter a price in dollars.", slug: "This slug is already used." },
      values: { name: "Cashmere scarf", slug: "taken", price: "12.345", categoryId: "1", stock: "3" },
    });
    render(<ProductForm categories={categories} />);
    fireEvent.change(input("Name"), { target: { value: "Cashmere scarf" } });

    await submit(/create product/i);

    expect(screen.getByRole("alert").textContent).toBe("Check the highlighted fields.");
    const price = input("Price (USD)");
    expect(price.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(price.getAttribute("aria-describedby")!)?.textContent).toBe("Enter a price in dollars.");
    expect(input("URL slug").getAttribute("aria-invalid")).toBe("true");
    expect(input("Name").getAttribute("aria-invalid")).toBeNull();
    // React resets the form after the action; the returned values are restored.
    expect(input("Name").value).toBe("Cashmere scarf");
    expect(price.value).toBe("12.345");
    expect(input("Initial stock").value).toBe("3");
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("1");
  });

  test("blocks a second submit while the first is pending", async () => {
    let resolve!: (state: Awaited<ReturnType<typeof createProductAction>>) => void;
    create.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<ProductForm categories={categories} />);

    await submit(/create product/i);
    const button = screen.getByRole("button", { name: /saving/i });
    expect(button.getAttribute("aria-busy")).toBe("true");
    await submit(/saving/i);
    expect(create).toHaveBeenCalledTimes(1);

    await act(async () => resolve({ ok: false, message: "Check the highlighted fields." }));
    expect(screen.getByRole("button", { name: /create product/i })).toBeTruthy();
  });
});
