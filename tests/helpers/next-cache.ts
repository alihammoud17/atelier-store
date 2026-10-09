import { vi } from "vitest";

// Stand-in for `next/cache`, installed for every integration test by setup-integration.ts.
// The real functions need a Next.js request store; tests assert on these spies instead.

export const revalidatePath = vi.fn();
export const revalidateTag = vi.fn();
export const updateTag = vi.fn();
export const refresh = vi.fn();

export function resetNextCacheMock() {
  for (const fn of [revalidatePath, revalidateTag, updateTag, refresh]) fn.mockReset();
}
