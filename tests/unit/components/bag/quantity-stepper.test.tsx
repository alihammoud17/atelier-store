// Run with: pnpm test (or pnpm exec vitest run tests/unit/components/bag/quantity-stepper.test.tsx)
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { updateBagQuantity } from "@/app/bag/actions";
import { QuantityStepper } from "@/components/bag/quantity-stepper";
import type { BagActionState } from "@/lib/bag";

vi.mock("@/app/bag/actions", () => ({ updateBagQuantity: vi.fn() }));
const update = vi.mocked(updateBagQuantity);

afterEach(() => {
  update.mockReset();
});

const stepper = (quantity: number, stock: number) =>
  render(<QuantityStepper productId={12} productName="Wool Coat" quantity={quantity} stock={stock} />);

describe("QuantityStepper", () => {
  test("shows the quantity and steps it up or down by one", async () => {
    update.mockResolvedValue({ ok: true, message: "Quantity updated." });
    stepper(2, 5);

    expect(screen.getByRole("group", { name: "Quantity of Wool Coat" }).textContent).toContain("2");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Increase quantity of Wool Coat" }));
    });
    expect(update).toHaveBeenLastCalledWith(12, 3);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Decrease quantity of Wool Coat" }));
    });
    expect(update).toHaveBeenLastCalledWith(12, 1);
  });

  test("labels − as remove at quantity 1", async () => {
    update.mockResolvedValue({ ok: true, message: "Removed from your bag.", quantity: 0 });
    stepper(1, 5);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove Wool Coat" }));
    });
    expect(update).toHaveBeenCalledWith(12, 0);
  });

  test("disables + at the stock level and says so", () => {
    stepper(3, 3);
    expect(screen.getByRole("button", { name: "Increase quantity of Wool Coat" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Maximum available")).toBeTruthy();
  });

  test("shows the server's message when a change is refused", async () => {
    update.mockResolvedValue({ ok: false, message: "Only 2 pieces available.", quantity: 2 });
    stepper(1, 5);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Increase quantity of Wool Coat" }));
    });
    expect(screen.getByText("Only 2 pieces available.").getAttribute("role")).toBe("status");
  });

  test("disables both buttons while a change is pending", async () => {
    let resolve: (state: BagActionState) => void = () => {};
    update.mockImplementation(() => new Promise((done) => (resolve = done)));
    stepper(2, 5);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Increase quantity of Wool Coat" }));
    });
    expect(screen.getByRole("group").getAttribute("aria-busy")).toBe("true");
    for (const button of screen.getAllByRole("button")) expect(button.hasAttribute("disabled")).toBe(true);
    await act(async () => {
      resolve({ ok: true, message: "Quantity updated." });
    });
  });
});
