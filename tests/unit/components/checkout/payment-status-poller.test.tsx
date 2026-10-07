// Run with: pnpm test (or pnpm exec vitest run tests/unit/components/checkout/payment-status-poller.test.tsx)
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PaymentStatusPoller } from "@/components/checkout/payment-status-poller";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  router.refresh.mockReset();
});

/** Advances the clock in 2 s polls, letting React schedule the next timer after each one. */
async function advance(ms: number) {
  for (let left = ms; left > 0; left -= 2_000) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.min(2_000, left));
    });
  }
}

describe("PaymentStatusPoller", () => {
  test("re-renders the page every 2 seconds while waiting", async () => {
    render(<PaymentStatusPoller />);
    expect(screen.getByRole("status").textContent).toContain("Checking with our payment provider");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_999);
    });
    expect(router.refresh).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    await advance(2_000 * 3);
    expect(router.refresh).toHaveBeenCalledTimes(4);
  });

  test("gives up after 15 checks and offers a manual retry", async () => {
    render(<PaymentStatusPoller />);

    await advance(2_000 * 15);
    expect(router.refresh).toHaveBeenCalledTimes(15);
    expect(screen.getByRole("status").textContent).toContain("This is taking longer than usual");

    await advance(60_000);
    expect(router.refresh).toHaveBeenCalledTimes(15);

    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(screen.getByRole("status").textContent).toContain("Checking with our payment provider");
    await advance(2_000);
    expect(router.refresh).toHaveBeenCalledTimes(16);
  });

  test("stops polling once the page stops rendering it (final status)", async () => {
    const { unmount } = render(<PaymentStatusPoller />);
    await advance(2_000);
    unmount();
    await advance(20_000);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
