// Grants the admin role to an existing user. Roles can't be set through the auth API.
// Usage: pnpm auth:make-admin you@example.com
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { user } from "./schema";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: pnpm auth:make-admin <email>");

  const updated = await db
    .update(user)
    .set({ role: "admin" })
    .where(eq(user.email, email))
    .returning({ id: user.id });
  if (updated.length === 0) throw new Error(`No user with email ${email}. Sign up first.`);

  console.log(`${email} is now an admin.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
