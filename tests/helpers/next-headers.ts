// In-memory stand-in for `next/headers`, installed for every integration test by
// setup-integration.ts. Server actions and route handlers read and write this jar as if it
// were the request's cookies; tests seed and inspect it through `testCookies`.

type CookieOptions = {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date | number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
  partitioned?: boolean;
  priority?: "low" | "medium" | "high";
};

type StoredCookie = { name: string; value: string; options: CookieOptions };

const jar = new Map<string, StoredCookie>();
const extraHeaders = new Headers();

const store = {
  get(name: string | { name: string }) {
    const key = typeof name === "string" ? name : name.name;
    const cookie = jar.get(key);
    return cookie ? { name: cookie.name, value: cookie.value } : undefined;
  },
  getAll(name?: string | { name: string }) {
    const all = [...jar.values()].map(({ name, value }) => ({ name, value }));
    if (name === undefined) return all;
    const key = typeof name === "string" ? name : name.name;
    return all.filter((cookie) => cookie.name === key);
  },
  has(name: string) {
    return jar.has(name);
  },
  set(
    nameOrCookie: string | ({ name: string; value: string } & CookieOptions),
    value?: string,
    options: CookieOptions = {},
  ) {
    if (typeof nameOrCookie === "string") {
      jar.set(nameOrCookie, { name: nameOrCookie, value: value ?? "", options });
    } else {
      const { name, value: cookieValue, ...rest } = nameOrCookie;
      jar.set(name, { name, value: cookieValue, options: rest });
    }
    return store;
  },
  delete(name: string | { name: string }) {
    jar.delete(typeof name === "string" ? name : name.name);
    return store;
  },
  get size() {
    return jar.size;
  },
  toString() {
    return cookieHeader();
  },
};

function cookieHeader() {
  return [...jar.values()]
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

export async function cookies() {
  return store;
}

/** Request headers: anything set with `testCookies.setHeader`, plus a `cookie` header from the jar. */
export async function headers() {
  const result = new Headers(extraHeaders);
  const cookie = cookieHeader();
  if (cookie) result.set("cookie", cookie);
  return result;
}

export async function draftMode() {
  return { isEnabled: false, enable() {}, disable() {} };
}

export const testCookies = {
  /** Clears all cookies and extra headers. Runs before every integration test. */
  reset() {
    jar.clear();
    for (const key of [...extraHeaders.keys()]) extraHeaders.delete(key);
  },
  /** Seeds the request cookies, e.g. `testCookies.seed({ atelier_bag: "12:2" })`. */
  seed(values: Record<string, string>) {
    for (const [name, value] of Object.entries(values)) jar.set(name, { name, value, options: {} });
  },
  /** The cookie's current value, or undefined once it has been deleted. */
  value(name: string) {
    return jar.get(name)?.value;
  },
  /** The options passed when the cookie was last set (empty for seeded cookies). */
  options(name: string) {
    return jar.get(name)?.options;
  },
  setHeader(name: string, value: string) {
    extraHeaders.set(name, value);
  },
};
