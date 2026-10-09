// Run with: pnpm test (or pnpm exec vitest run tests/unit/app/admin/guards.test.ts)
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

// Static guard: every admin page and server action must call requireAdmin() before doing
// anything else. The admin layout and proxy.ts don't count (see CLAUDE.md), so a new page or
// action without its own check fails here, even before anyone writes a test for it.

const adminDir = join(process.cwd(), "src/app/admin");
const files = readdirSync(adminDir, { recursive: true, encoding: "utf8" }).map((file) => join(adminDir, file));
const named = (name: string) => files.filter((file) => file.endsWith(`/${name}`) || file === join(adminDir, name));
const label = (file: string) => relative(process.cwd(), file);

const pages = named("page.tsx");
const actionFiles = named("actions.ts");

test("finds the admin pages and actions", () => {
  expect(pages.length).toBeGreaterThanOrEqual(9);
  expect(actionFiles.length).toBeGreaterThanOrEqual(3);
});

describe("admin pages", () => {
  test.each(pages.map((file) => [label(file), file]))("%s calls requireAdmin() first", (_, file) => {
    const source = readFileSync(file, "utf8");
    // The default export's first statement awaits requireAdmin(), optionally keeping the session.
    expect(source).toMatch(
      /export default async function \w+\([^)]*\)[^{]*\{\s*(?:const \{[^}]*\} = )?await requireAdmin\(\);/,
    );
  });
});

describe("admin server actions", () => {
  test.each(actionFiles.map((file) => [label(file), file]))("%s checks the admin role in every action", (_, file) => {
    const source = readFileSync(file, "utf8");
    expect(source.startsWith('"use server";')).toBe(true);

    const exports = [...source.matchAll(/^export (.*)$/gm)].map((match) => match[1]);
    const actions = [...source.matchAll(/^export async function (\w+)\([^)]*\)[^{]*\{\s*(.*)$/gm)];
    expect(actions.length).toBeGreaterThan(0);
    // Nothing else is exported, so no action can hide behind a different declaration style.
    expect(exports).toHaveLength(actions.length);
    for (const [, name, firstStatement] of actions) {
      expect(firstStatement, `${name} must start with await requireAdmin()`).toBe("await requireAdmin();");
    }
  });
});
