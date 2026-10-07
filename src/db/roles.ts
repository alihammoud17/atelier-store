import { eq } from "drizzle-orm";
import { db } from "./index";
import { user } from "./schema";

/**
 * Gives an existing user the admin role. Roles can't be set through the auth API, so this
 * (via `pnpm auth:make-admin`) is the only way to grant it. Returns false when no user has
 * that email.
 */
export async function grantAdminRole(email: string) {
  const updated = await db
    .update(user)
    .set({ role: "admin" })
    .where(eq(user.email, email.trim().toLowerCase()))
    .returning({ id: user.id });
  return updated.length > 0;
}
