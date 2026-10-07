// Any origin we don't serve; only used to check where a path resolves.
const PROBE_ORIGIN = "https://atelier.invalid";

// Client-safe: used by the auth pages and forms to honour ?next= without an open redirect.
export function safeNext(next: unknown, fallback = "/account") {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  // Resolve the path the way the browser will. URL parsing strips tabs and newlines and treats
  // "\" as "/", so "/\t/evil.com" and "/\evil.com" both become //evil.com: another origin.
  let url: URL;
  try {
    url = new URL(next, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PROBE_ORIGIN || url.pathname.startsWith("//")) return fallback;
  // Return the normalized form, so the browser navigates to exactly what was checked.
  return url.pathname + url.search + url.hash;
}
