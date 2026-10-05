// Runs after the Better Auth generator (see `auth:generate`). The generator always emits
// timezone-less `timestamp("…")` for Postgres; rewrite them to timestamptz to match the
// catalog tables, so stored instants don't depend on the reader's TimeZone setting.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("./auth-schema.ts", import.meta.url);
const source = readFileSync(file, "utf8");

let count = 0;
const patched = source.replace(/timestamp\("([a-z_]+)"\)/g, (_match, column: string) => {
  count++;
  return `timestamp("${column}", { withTimezone: true })`;
});

if (count === 0 && !source.includes("withTimezone: true")) {
  throw new Error("No timestamp columns found in auth-schema.ts; has the generator output changed?");
}

writeFileSync(file, patched);
console.log(`patch-auth-schema: ${count} timestamp column(s) set to withTimezone.`);
