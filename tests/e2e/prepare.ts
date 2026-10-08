// Prepares the E2E database before the app is built: applies migrations, empties every table
// and seeds the starter catalog. Run by playwright.config.ts's webServer command, so the
// build (which prerenders catalog pages) sees the seeded data.
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import migrateTestDatabase from "../helpers/global-setup";
import { e2eDatabaseUrl } from "./env";

async function main() {
  const url = e2eDatabaseUrl();
  process.env.DATABASE_URL = url;
  await migrateTestDatabase();

  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const { rows } = await client.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public'");
    if (rows.length > 0) {
      await client.query(`truncate table ${rows.map(({ tablename }) => `"public"."${tablename}"`).join(", ")} restart identity cascade`);
    }
  } finally {
    await client.end();
  }

  // The seed script loads dotenv, which never overrides DATABASE_URL set here.
  execFileSync("pnpm", ["db:seed"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
