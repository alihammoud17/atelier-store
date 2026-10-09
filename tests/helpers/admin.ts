import { expect } from "vitest";
import { signUpAndSignIn } from "./auth";
import { revalidatePath } from "./next-cache";
import { expectNotFound, expectRedirect } from "./navigation";
import { testCookies } from "./next-headers";

// Shared checks for admin server actions.

/** A FormData built from plain values, as a browser form would submit it. */
export function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

/**
 * Calls `run` as a signed-out visitor and then as a signed-in customer, and expects the
 * admin guard to stop both: a sign-in redirect, then a 404. Nothing may be revalidated.
 */
export async function expectAdminOnly(run: () => Promise<unknown>) {
  expect(await expectRedirect(run)).toBe("/sign-in?next=%2Fadmin");
  await signUpAndSignIn();
  await expectNotFound(run);
  expect(revalidatePath).not.toHaveBeenCalled();
  testCookies.reset();
}
