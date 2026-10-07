// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/lib/session.test.ts)
import { describe, expect, test } from "vitest";
import { getSession, requireAdmin, requireSession } from "@/lib/session";
import { signUpAndSignIn } from "@tests/helpers/auth";
import { expectNotFound, expectRedirect } from "@tests/helpers/navigation";
import { testCookies } from "@tests/helpers/next-headers";

describe("getSession", () => {
  test("is null for visitors and returns the signed-in customer", async () => {
    expect(await getSession()).toBeNull();
    const customer = await signUpAndSignIn();
    expect((await getSession())?.user).toMatchObject({ id: customer.id, email: customer.email, role: "customer" });
  });

  test("rejects a forged session cookie", async () => {
    testCookies.seed({ "better-auth.session_token": "forged.token" });
    expect(await getSession()).toBeNull();
  });
});

describe("requireSession", () => {
  test("redirects visitors to sign-in with an encoded return path", async () => {
    expect(await expectRedirect(() => requireSession("/account/orders/abc?x=1"))).toBe(
      "/sign-in?next=%2Faccount%2Forders%2Fabc%3Fx%3D1",
    );
  });

  test("returns the session for a signed-in customer", async () => {
    const customer = await signUpAndSignIn();
    expect((await requireSession("/account")).user.id).toBe(customer.id);
  });
});

describe("requireAdmin", () => {
  test("redirects visitors to sign-in", async () => {
    expect(await expectRedirect(() => requireAdmin())).toBe("/sign-in?next=%2Fadmin");
  });

  test("hides the admin area from customers with a 404", async () => {
    await signUpAndSignIn();
    await expectNotFound(() => requireAdmin());
  });

  test("lets admins in as soon as the role is granted, despite the cached session cookie", async () => {
    const admin = await signUpAndSignIn({ role: "admin" });
    // The 5-minute cookie cache still says "customer"; requireAdmin must not trust it.
    expect((await getSession())?.user.role).toBe("customer");
    expect((await requireAdmin()).user).toMatchObject({ id: admin.id, role: "admin" });
  });
});
