// Run with: pnpm test (or pnpm exec vitest run tests/unit/components/admin/stock-form.test.tsx)
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { updateStockAction } from "@/app/admin/stock/actions";
import { StockForm } from "@/components/admin/stock-form";

vi.mock("@/app/admin/stock/actions", () => ({ updateStockAction: vi.fn() }));
const update = vi.mocked(updateStockAction);

afterEach(() => {
  update.mockReset();
});

const quantity = () => screen.getByLabelText("Available stock for Wool coat") as HTMLInputElement;
const hidden = (name: string) => (document.querySelector(`input[name="${name}"]`) as HTMLInputElement).value;

async function save(value: string) {
  fireEvent.change(quantity(), { target: { value } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
}

describe("StockForm", () => {
  test("sends the new quantity with the quantity it showed as expected", async () => {
    update.mockResolvedValue({ ok: true, message: "Stock set to 9 units.", quantity: 9 });
    const { rerender } = render(<StockForm productId={7} productName="Wool coat" available={4} />);
    expect(quantity().value).toBe("4");

    await save("9");
    const formData = update.mock.calls[0][1];
    expect(Object.fromEntries(formData)).toEqual({ productId: "7", expected: "4", quantity: "9" });
    expect(screen.getByRole("status").textContent).toBe("Stock set to 9 units.");

    // The action revalidates, so the page re-renders with what the database now holds.
    rerender(<StockForm productId={7} productName="Wool coat" available={9} />);
    expect(quantity().value).toBe("9");
    expect(hidden("expected")).toBe("9");
  });

  test("expected follows the available prop, not a stale action result", async () => {
    update.mockResolvedValue({ ok: true, message: "Stock set to 9 units.", quantity: 9 });
    const { rerender } = render(<StockForm productId={7} productName="Wool coat" available={4} />);
    await save("9");

    // A checkout (or the adjust form) then takes stock to 6; the page re-renders with it.
    rerender(<StockForm productId={7} productName="Wool coat" available={6} />);
    expect(hidden("expected")).toBe("6");
    expect(quantity().value).toBe("6");

    await save("12");
    expect(update.mock.calls[1][1].get("expected")).toBe("6");
  });

  test("shows a conflict, then starts from the current stock the page re-renders with", async () => {
    update.mockResolvedValue({
      ok: false,
      message: "Stock changed to 2 units since you loaded this page. Check it and save again.",
      quantity: 2,
    });
    const { rerender } = render(<StockForm productId={7} productName="Wool coat" available={4} />);

    await save("20");
    expect(screen.getByRole("alert").textContent).toBe(
      "Stock changed to 2 units since you loaded this page. Check it and save again.",
    );
    rerender(<StockForm productId={7} productName="Wool coat" available={2} />);
    expect(quantity().value).toBe("2");
    expect(hidden("expected")).toBe("2");

    update.mockResolvedValue({ ok: true, message: "Stock set to 20 units.", quantity: 20 });
    await save("20");
    expect(update.mock.calls[1][1].get("expected")).toBe("2");
  });

  test("marks the field invalid and keeps what was typed when the quantity is rejected", async () => {
    update.mockResolvedValue({
      ok: false,
      message: "Check the quantity.",
      fieldErrors: { quantity: "Enter a whole number from 0 to 100000." },
      values: { productId: "7", expected: "4", quantity: "-1" },
    });
    render(<StockForm productId={7} productName="Wool coat" available={4} />);

    await save("-1");
    expect(quantity().getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Enter a whole number from 0 to 100000.");
    expect(quantity().value).toBe("-1");
    expect(hidden("expected")).toBe("4");
  });

  test("drops what was typed once stock has moved, showing the current value", async () => {
    update.mockResolvedValue({
      ok: false,
      message: "Check the quantity.",
      fieldErrors: { quantity: "Enter a whole number from 0 to 100000." },
      values: { productId: "7", expected: "4", quantity: "-1" },
    });
    const { rerender } = render(<StockForm productId={7} productName="Wool coat" available={4} />);
    await save("-1");

    rerender(<StockForm productId={7} productName="Wool coat" available={7} />);
    expect(quantity().value).toBe("7");
  });
});
