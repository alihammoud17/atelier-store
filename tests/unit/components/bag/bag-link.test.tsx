// Run with: pnpm test (or pnpm exec vitest run tests/unit/components/bag/bag-link.test.tsx)
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { BagLink } from "@/components/bag/bag-link";
import { BAG_CHANGE_EVENT, BAG_COOKIE } from "@/lib/bag";

const setBagCookie = (value: string) => {
  document.cookie = `${BAG_COOKIE}=${encodeURIComponent(value)}; path=/`;
};

afterEach(() => {
  document.cookie = `${BAG_COOKIE}=; path=/; max-age=0`;
});

describe("BagLink", () => {
  test("links to the bag without a count when the bag is empty", () => {
    render(<BagLink />);
    const link = screen.getByRole("link", { name: "Shopping bag" });
    expect(link.getAttribute("href")).toBe("/bag");
    expect(link.textContent).toBe("");
  });

  test("shows the number of pieces from the bag cookie", () => {
    setBagCookie("12:2,3:1");
    render(<BagLink />);
    const link = screen.getByRole("link", { name: "Shopping bag, 3 items" });
    expect(link.textContent).toBe("3");
  });

  test("uses the singular for one piece and caps the badge at 99+", () => {
    setBagCookie("12:1");
    const { unmount } = render(<BagLink />);
    expect(screen.getByRole("link", { name: "Shopping bag, 1 item" })).toBeTruthy();
    unmount();

    setBagCookie("12:60,13:60");
    render(<BagLink />);
    expect(screen.getByRole("link", { name: "Shopping bag, 120 items" }).textContent).toBe("99+");
  });

  test("updates when a bag action announces a change", () => {
    render(<BagLink />);
    setBagCookie("12:4");
    act(() => {
      window.dispatchEvent(new Event(BAG_CHANGE_EVENT));
    });
    expect(screen.getByRole("link", { name: "Shopping bag, 4 items" })).toBeTruthy();
  });

  test("re-reads the cookie when the tab regains focus", () => {
    setBagCookie("12:1");
    render(<BagLink />);
    setBagCookie("12:1,13:1");
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(screen.getByRole("link", { name: "Shopping bag, 2 items" })).toBeTruthy();
  });

  test("ignores a malformed cookie", () => {
    document.cookie = `${BAG_COOKIE}=%E0%A4%A; path=/`;
    render(<BagLink />);
    expect(screen.getByRole("link", { name: "Shopping bag" })).toBeTruthy();
  });
});
