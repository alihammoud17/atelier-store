import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { testCookies } from "./next-headers";

// Real Better Auth sessions for integration tests. Better Auth's nextCookies() plugin doesn't
// write to the test cookie jar, so the Set-Cookie headers are copied into it here.

let sequence = 0;

/** Stores each Set-Cookie header in the test jar, as the browser would. */
export function storeSetCookies(headers: Headers) {
  for (const setCookie of headers.getSetCookie()) {
    const [pair] = setCookie.split(";");
    const index = pair.indexOf("=");
    const name = pair.slice(0, index).trim();
    const value = decodeURIComponent(pair.slice(index + 1));
    if (/max-age=0\b/i.test(setCookie) || value === "") testCookies.remove(name);
    else testCookies.seed({ [name]: value });
  }
}

/**
 * Signs up a customer through Better Auth and keeps their session cookies, so code under test
 * sees a signed-in request. `role: "admin"` is granted in the database afterwards, the same way
 * `pnpm auth:make-admin` does (the cached session cookie still says "customer").
 */
export async function signUpAndSignIn({
  name,
  email,
  password = "correct-horse-battery",
  role,
}: { name?: string; email?: string; password?: string; role?: "admin" } = {}) {
  const n = ++sequence;
  const result = await auth.api.signUpEmail({
    body: { name: name ?? `Customer ${n}`, email: email ?? `signed-in-${n}@example.com`, password },
    returnHeaders: true,
  });
  storeSetCookies(result.headers);
  if (role) await db.update(user).set({ role }).where(eq(user.id, result.response.user.id));
  return { ...result.response.user, password };
}
