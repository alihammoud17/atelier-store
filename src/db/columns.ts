import { timestamp } from "drizzle-orm/pg-core";

// Shared column helpers. Kept out of schema.ts so they aren't mistaken for tables.

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
