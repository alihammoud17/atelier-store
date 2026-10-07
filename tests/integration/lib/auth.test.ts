// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/lib/auth.test.ts)
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { describe, expect, test } from "vitest";
import { db } from "@/db";
import { account, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { signUpAndSignIn, storeSetCookies } from "@tests/helpers/auth";
import { testCookies } from "@tests/helpers/next-headers";

const errorOf = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: { status?: string; body?: { code?: string } }) => ({ status: error.status, code: error.body?.code }),
  );

describe("email and password sign-up", () => {
  test("creates a customer with a hashed password and starts a session", async () => {
    const result = await auth.api.signUpEmail({
      body: { name: "Ada", email: "ada@example.com", password: "correct-horse-battery" },
      returnHeaders: true,
    });

    const [row] = await db.select().from(user).where(eq(user.email, "ada@example.com"));
    expect(row).toMatchObject({ name: "Ada", role: "customer", emailVerified: false });
    const [credential] = await db.select().from(account).where(eq(account.userId, row.id));
    expect(credential.password).toBeTruthy();
    expect(credential.password).not.toContain("correct-horse-battery");
    expect(result.headers.getSetCookie().some((cookie) => cookie.startsWith("better-auth.session_token="))).toBe(true);
  });

  test("ignores a role sent with the sign-up", async () => {
    await auth.api.signUpEmail({
      body: { name: "Mallory", email: "mallory@example.com", password: "correct-horse-battery", role: "admin" } as never,
    });
    const [row] = await db.select({ role: user.role }).from(user).where(eq(user.email, "mallory@example.com"));
    expect(row.role).toBe("customer");
  });

  test("refuses a duplicate email and passwords outside 8–128 characters", async () => {
    await signUpAndSignIn({ email: "taken@example.com" });
    testCookies.reset();

    expect(await errorOf(auth.api.signUpEmail({ body: { name: "Again", email: "taken@example.com", password: "correct-horse-battery" } }))).toMatchObject({
      code: expect.stringMatching(/^USER_ALREADY_EXISTS/),
    });
    expect(await errorOf(auth.api.signUpEmail({ body: { name: "Short", email: "short@example.com", password: "1234567" } }))).toMatchObject({
      code: "PASSWORD_TOO_SHORT",
    });
    expect(await errorOf(auth.api.signUpEmail({ body: { name: "Long", email: "long@example.com", password: "x".repeat(129) } }))).toMatchObject({
      code: "PASSWORD_TOO_LONG",
    });
  });
});

describe("sign-in", () => {
  test("accepts the right password and rejects a wrong one with a generic error", async () => {
    const customer = await signUpAndSignIn({ email: "member@example.com" });
    testCookies.reset();

    expect(await errorOf(auth.api.signInEmail({ body: { email: "member@example.com", password: "wrong-password" } }))).toEqual({
      status: "UNAUTHORIZED",
      code: "INVALID_EMAIL_OR_PASSWORD",
    });
    expect(await errorOf(auth.api.signInEmail({ body: { email: "nobody@example.com", password: "wrong-password" } }))).toEqual({
      status: "UNAUTHORIZED",
      code: "INVALID_EMAIL_OR_PASSWORD",
    });

    const result = await auth.api.signInEmail({ body: { email: "member@example.com", password: customer.password }, returnHeaders: true });
    storeSetCookies(result.headers);
    expect((await auth.api.getSession({ headers: await headers() }))?.user.id).toBe(customer.id);
  });

  test("signing out ends the session", async () => {
    await signUpAndSignIn();
    const result = await auth.api.signOut({ headers: await headers(), returnHeaders: true });
    const sessionCookie = (await headers()).get("cookie");
    storeSetCookies(result.headers);

    expect(await auth.api.getSession({ headers: new Headers({ cookie: sessionCookie ?? "" }), query: { disableCookieCache: true } })).toBeNull();
  });
});

describe("roles", () => {
  test("a signed-in customer can't promote themselves", async () => {
    const customer = await signUpAndSignIn();

    expect(await errorOf(auth.api.updateUser({ body: { role: "admin" } as never, headers: await headers() }))).toEqual({
      status: "BAD_REQUEST",
      code: "FIELD_NOT_ALLOWED",
    });
    const [row] = await db.select({ role: user.role }).from(user).where(eq(user.id, customer.id));
    expect(row.role).toBe("customer");
  });
});
