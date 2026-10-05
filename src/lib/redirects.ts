// Client-safe: used by the auth pages and forms to honour ?next= without an open redirect.
export function safeNext(next: unknown, fallback = "/account") {
  if (typeof next !== "string") return fallback;
  // Same-origin paths only: "/x" is fine, "//evil.com" and "/\evil.com" are not.
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
