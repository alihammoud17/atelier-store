import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { assertTestDatabaseUrl, testDatabaseUrl } from "./env";

// Runs once before the integration project: creates the test database if it's missing and
// applies the committed migrations from ./drizzle, the same SQL production runs.
export default async function setup() {
  const url = assertTestDatabaseUrl(testDatabaseUrl());
  await createDatabaseIfMissing(url);

  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  } finally {
    await client.end();
  }
}

async function createDatabaseIfMissing(url: string) {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";

  const client = new Client({ connectionString: maintenance.toString() });
  try {
    await client.connect();
    const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (rowCount === 0) await client.query(`create database "${name.replaceAll('"', '""')}"`);
  } finally {
    await client.end();
  }
}
