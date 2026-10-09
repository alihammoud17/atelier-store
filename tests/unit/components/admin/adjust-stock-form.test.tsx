// Run with: pnpm test (or pnpm exec vitest run tests/unit/components/admin/adjust-stock-form.test.tsx)
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { adjustStockAction } from "@/app/admin/stock/actions";
import { AdjustStockForm } from "@/components/admin/adjust-stock-form";

vi.mock("@/app/admin/stock/actions", () => ({ adjustStockAction: vi.fn() }));
const adjust = vi.mocked(adjustStockAction);

afterEach(() => {
  adjust.mockReset();
});

const amount = () => screen.getByLabelText("Units to add or remove for Wool coat") as HTMLInputElement;

async function press(button: "Add" | "Remove", value: string) {
  fireEvent.change(amount(), { target: { value } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: button }));
  });
}

describe("AdjustStockForm", () => {
  test("sends the amount with the button pressed as the direction, then clears the field", async () => {
    adjust.mockResolvedValue({ ok: true, message: "Added 12 units. 30 available.", quantity: 30 });
    render(<AdjustStockForm productId={7} productName="Wool coat" />);

    await press("Add", "12");
    expect(Object.fromEntries(adjust.mock.calls[0][1])).toEqual({ productId: "7", direction: "add", amount: "12" });
    expect(screen.getByRole("status").textContent).toBe("Added 12 units. 30 available.");
    expect(amount().value).toBe("");

    adjust.mockResolvedValue({ ok: true, message: "Removed 2 units. 28 available.", quantity: 28 });
    await press("Remove", "2");
    expect(adjust.mock.calls[1][1].get("direction")).toBe("remove");
  });

  test("marks the field invalid and keeps the amount when it's refused", async () => {
    const message = "Only 2 units available to remove.";
    adjust.mockResolvedValue({
      ok: false,
      message,
      fieldErrors: { amount: message },
      values: { productId: "7", direction: "remove", amount: "3" },
      quantity: 2,
    });
    render(<AdjustStockForm productId={7} productName="Wool coat" />);

    await press("Remove", "3");
    expect(amount().getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(amount().value).toBe("3");
  });

  test("is busy while the action runs and ignores another submit", async () => {
    let finish: (state: Awaited<ReturnType<typeof adjustStockAction>>) => void = () => {};
    adjust.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const { container } = render(<AdjustStockForm productId={7} productName="Wool coat" />);

    await press("Add", "1");
    expect(container.querySelector("form")?.getAttribute("aria-busy")).toBe("true");
    await press("Add", "1");
    expect(adjust).toHaveBeenCalledTimes(1);

    await act(async () => finish({ ok: true, message: "Added 1 unit. 5 available.", quantity: 5 }));
    expect(container.querySelector("form")?.getAttribute("aria-busy")).toBe("false");
    expect(screen.getByRole("status").textContent).toBe("Added 1 unit. 5 available.");
  });
});
