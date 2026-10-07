// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/proxy.test.ts)
import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { config, proxy } from "@/proxy";

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });

describe("proxy", () => {
  test("sends visitors without a session cookie to sign-in, keeping where they were going", () => {
    const response = proxy(request("/account/orders/3f1c2b9e?tab=items"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/account/orders/3f1c2b9e?tab=items");
  });

  test("lets requests with a session cookie through without checking it", () => {
    // Optimistic only: a forged cookie passes here; pages verify with requireSession().
    for (const cookie of ["better-auth.session_token=anything", "__Secure-better-auth.session_token=anything"]) {
      const response = proxy(request("/admin", cookie));
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  });

  test("ignores unrelated cookies", () => {
    expect(proxy(request("/account", "atelier_bag=1:1; theme=dark")).status).toBe(307);
  });

  test("only runs for the account and admin areas", () => {
    expect(config.matcher).toEqual(["/account/:path*", "/admin/:path*"]);
  });
});
