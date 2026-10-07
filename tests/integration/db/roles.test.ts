// Run with: pnpm test:int (or pnpm exec vitest run tests/integration/db/roles.test.ts)
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "@/db";
import { grantAdminRole } from "@/db/roles";
import { user } from "@/db/schema";
import { createUser } from "@tests/helpers/factories";

const roleOf = async (id: string) => (await db.select({ role: user.role }).from(user).where(eq(user.id, id)))[0].role;

test("grantAdminRole promotes only the user with that email, ignoring case and spaces", async () => {
  const target = await createUser({ email: "owner@example.com" });
  const bystander = await createUser();

  expect(await grantAdminRole("  OWNER@example.com ")).toBe(true);
  expect(await roleOf(target.id)).toBe("admin");
  expect(await roleOf(bystander.id)).toBe("customer");
});

test("grantAdminRole reports an unknown email", async () => {
  expect(await grantAdminRole("nobody@example.com")).toBe(false);
});
