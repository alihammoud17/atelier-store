// Run with: pnpm test (or pnpm exec vitest run tests/unit/components/bag/use-bag-action.test.tsx)
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useBagAction } from "@/components/bag/use-bag-action";
import { BAG_CHANGE_EVENT, type BagActionState } from "@/lib/bag";

const listener = vi.fn();

afterEach(() => {
  window.removeEventListener(BAG_CHANGE_EVENT, listener);
  listener.mockReset();
});

describe("useBagAction", () => {
  test("runs the action, keeps its result and tells the header to refresh", async () => {
    window.addEventListener(BAG_CHANGE_EVENT, listener);
    const action = vi.fn(async (productId: number) => ({ ok: true, message: `Added ${productId}.`, quantity: 1 }));
    const { result } = renderHook(() => useBagAction(action));

    expect(result.current.state).toBeNull();
    await act(async () => {
      result.current.run(7);
    });

    expect(action).toHaveBeenCalledWith(7);
    expect(result.current.state).toEqual({ ok: true, message: "Added 7.", quantity: 1 });
    expect(result.current.pending).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("turns a thrown action into a friendly message, and still refreshes the header", async () => {
    window.addEventListener(BAG_CHANGE_EVENT, listener);
    const { result } = renderHook(() => useBagAction(async () => Promise.reject(new Error("network"))));

    await act(async () => {
      result.current.run();
    });

    expect(result.current.state).toEqual({ ok: false, message: "We couldn't update your bag. Please try again." });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("ignores clicks while an action is still running", async () => {
    let resolve: (state: BagActionState) => void = () => {};
    const action = vi.fn(() => new Promise<BagActionState>((done) => (resolve = done)));
    const { result } = renderHook(() => useBagAction(action));

    act(() => {
      result.current.run();
    });
    expect(result.current.pending).toBe(true);
    act(() => {
      result.current.run();
    });
    await act(async () => {
      resolve({ ok: true, message: "Done." });
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(false);
  });
});
