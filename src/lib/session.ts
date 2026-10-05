import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

// Memoized per request, so a layout and page can both call it for one lookup.
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

// Call at the top of every customer page and server action; proxy.ts is only an optimistic check.
export async function requireSession(returnTo: string) {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return session;
}

// Call at the top of every admin page and server action.
export async function requireAdmin() {
  // Skip the cookie cache so a role change applies on the next request.
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session) redirect("/sign-in?next=%2Fadmin");
  // 404 rather than 403 so the admin area isn't advertised.
  if (session.user.role !== "admin") notFound();
  return session;
}
