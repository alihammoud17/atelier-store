// Run with: pnpm test (or pnpm exec vitest run tests/unit/components/auth/auth-form.test.tsx)
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthForm } from "@/components/auth/auth-form";
import { authClient } from "@/lib/auth-client";

vi.mock("@/lib/auth-client", () => ({
  authClient: { signUp: { email: vi.fn() }, signIn: { email: vi.fn() } },
}));
const signUp = vi.mocked(authClient.signUp.email);
const signIn = vi.mocked(authClient.signIn.email);

// jsdom's location.assign can't be spied on, so the whole location is swapped for the test.
const realLocation = window.location;
const assign = vi.fn();
beforeEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, assign } });
});
afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
  assign.mockReset();
  signUp.mockReset();
  signIn.mockReset();
});

type Values = Partial<Record<"Name" | "Email" | "Password", string>>;

function fill(values: Values) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

async function submit() {
  await act(async () => {
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
  });
}

const authError = (error: { status: number; code?: string; message?: string }) =>
  ({ data: null, error }) as unknown as Awaited<ReturnType<typeof signIn>>;
const ok = { data: {}, error: null } as unknown as Awaited<ReturnType<typeof signIn>>;

describe("AuthForm validation", () => {
  test("sign-up asks for every field and focuses the first problem", async () => {
    render(<AuthForm mode="sign-up" next="/account" />);
    await submit();

    expect(screen.getByText("Enter your name.")).toBeTruthy();
    expect(screen.getByText("Enter your email address.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(signUp).not.toHaveBeenCalled();
  });

  test("sign-up checks the email format and the password length", async () => {
    render(<AuthForm mode="sign-up" next="/account" />);

    fill({ Name: "Ada", Email: "ada@example", Password: "short" });
    await submit();
    expect(screen.getByText("Enter an email address like name@example.com.")).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Email"));

    fill({ Email: "ada@example.com", Password: "x".repeat(129) });
    await submit();
    expect(screen.getByText("Use 128 characters or fewer.")).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  test("sign-in doesn't reveal the password rules", async () => {
    signIn.mockResolvedValue(ok);
    render(<AuthForm mode="sign-in" next="/account" />);
    expect(screen.queryByLabelText("Name")).toBeNull();

    fill({ Email: "ada@example.com", Password: "short" });
    await submit();
    expect(screen.queryByText(/characters/)).toBeNull();
    expect(signIn).toHaveBeenCalledWith({ email: "ada@example.com", password: "short" });
  });

  test("editing a field clears its message", async () => {
    render(<AuthForm mode="sign-in" next="/account" />);
    await submit();
    expect(screen.getByText("Enter your email address.")).toBeTruthy();

    fill({ Email: "a" });
    expect(screen.queryByText("Enter your email address.")).toBeNull();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
  });
});

describe("AuthForm submission", () => {
  test("signs up with trimmed values and loads the next page", async () => {
    signUp.mockResolvedValue(ok);
    render(<AuthForm mode="sign-up" next="/account/orders" />);

    fill({ Name: "  Ada Lovelace ", Email: " ada@example.com ", Password: " padded password " });
    await submit();

    expect(signUp).toHaveBeenCalledWith({ name: "Ada Lovelace", email: "ada@example.com", password: " padded password " });
    expect(assign).toHaveBeenCalledWith("/account/orders");
    expect(screen.getByRole("button", { name: "Creating account…" }).getAttribute("aria-disabled")).toBe("true");
  });

  test("a wrong password shows a generic message on the password field", async () => {
    signIn.mockResolvedValue(authError({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" }));
    render(<AuthForm mode="sign-in" next="/account" />);

    fill({ Email: "ada@example.com", Password: "wrong-password" });
    await submit();

    expect(screen.getByRole("alert").textContent).toBe("That email and password don't match our records.");
    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Password"));
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  test("an existing account links to sign-in, keeping the next page", async () => {
    signUp.mockResolvedValue(authError({ status: 422, code: "USER_ALREADY_EXISTS" }));
    render(<AuthForm mode="sign-up" next="/account/orders?x=1" />);

    fill({ Name: "Ada", Email: "ada@example.com", Password: "correct-horse-battery" });
    await submit();

    expect(screen.getByRole("alert").textContent).toContain("An account with this email already exists.");
    expect(screen.getByRole("link", { name: "Sign in instead" }).getAttribute("href")).toBe(
      "/sign-in?next=%2Faccount%2Forders%3Fx%3D1",
    );
  });

  test("rate limits and unknown errors get their own messages", async () => {
    signIn.mockResolvedValueOnce(authError({ status: 429 })).mockResolvedValueOnce(authError({ status: 500, code: "SOMETHING_NEW" }));
    render(<AuthForm mode="sign-in" next="/account" />);
    fill({ Email: "ada@example.com", Password: "password" });

    await submit();
    expect(screen.getByRole("alert").textContent).toBe("Too many attempts. Please wait a minute and try again.");
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("Something went wrong on our side. Please try again.");
  });

  test("a network failure asks the customer to check their connection", async () => {
    signIn.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AuthForm mode="sign-in" next="/account" />);
    fill({ Email: "ada@example.com", Password: "password" });

    await submit();
    expect(screen.getByRole("alert").textContent).toBe("We couldn't reach the server. Check your connection and try again.");
    expect(assign).not.toHaveBeenCalled();
  });

  test("ignores a second submit while the first is in flight", async () => {
    signIn.mockImplementation(() => new Promise(() => {}));
    render(<AuthForm mode="sign-in" next="/account" />);
    fill({ Email: "ada@example.com", Password: "password" });

    await submit();
    await submit();
    expect(signIn).toHaveBeenCalledTimes(1);
  });
});
