// Smoke test for the component project (jsdom + Testing Library). Run with: pnpm test
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Button } from "@/components/ui";

test("renders a client component into jsdom", () => {
  render(<Button type="submit">Add to bag</Button>);
  expect(screen.getByRole("button", { name: "Add to bag" }).getAttribute("type")).toBe("submit");
});
