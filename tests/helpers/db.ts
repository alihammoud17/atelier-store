import { sql } from "drizzle-orm";
import { db } from "@/db";
import { assertTestDatabaseUrl } from "./env";

/** Empties every table in the public schema and restarts identity columns. */
export async function resetDb() {
  assertTestDatabaseUrl(process.env.DATABASE_URL);
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (rows.length === 0) return;
  const tables = rows.map(({ tablename }) => `"public"."${tablename}"`).join(", ");
  await db.execute(sql.raw(`truncate table ${tables} restart identity cascade`));
}

/** Ends the shared pool. `@/db` caches it on globalThis, so drop that too for the next file. */
export async function closeDb() {
  await db.$client.end();
  delete (globalThis as { pool?: unknown }).pool;
}
