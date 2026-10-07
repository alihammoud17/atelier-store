// Shopping bag types and pure helpers. Client-safe: never import `@/db` here.
// The bag lives in a cookie that holds product IDs and quantities only; prices, names and
// stock are always read from Postgres (see `getBag` in `@/lib/bag-server`).
import type { Product } from "@/lib/catalog";

export const BAG_COOKIE = "atelier_bag";
export const MAX_BAG_LINES = 50;
/** Largest quantity one cookie line can hold (4 digits); actions cap quantities here too. */
export const MAX_LINE_QUANTITY = 9_999;
/** Dispatched on `window` after a bag action resolves, so the header count can update. */
export const BAG_CHANGE_EVENT = "bag-change";

export type BagLine = {
  productId: number;
  quantity: number;
};

export type BagItem = Product & {
  /** Units available right now. */
  stock: number;
  /** Quantity in the cookie, before clamping to stock. */
  requested: number;
  /** Quantity shown and charged: `min(requested, stock)`. */
  quantity: number;
  lineTotalCents: number;
};

/** Result of a bag server action, shaped for `useActionState`. */
export type BagActionState = { ok: boolean; message: string; quantity?: number } | null;

function isPositiveInt(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

/** "12:2,15:1" → lines. Drops malformed entries and duplicates, caps at MAX_BAG_LINES. */
export function parseBag(raw: string | undefined | null): BagLine[] {
  if (!raw) return [];
  const lines: BagLine[] = [];
  const seen = new Set<number>();
  for (const entry of raw.split(",")) {
    const match = /^(\d{1,9}):(\d{1,4})$/.exec(entry.trim());
    if (!match) continue;
    const productId = Number(match[1]);
    const quantity = Number(match[2]);
    if (!isPositiveInt(productId) || !isPositiveInt(quantity) || quantity > MAX_LINE_QUANTITY) continue;
    if (seen.has(productId)) continue;
    seen.add(productId);
    lines.push({ productId, quantity });
    if (lines.length === MAX_BAG_LINES) break;
  }
  return lines;
}

export function serializeBag(lines: BagLine[]) {
  return lines.map((line) => `${line.productId}:${line.quantity}`).join(",");
}

export function countItems(lines: Pick<BagLine, "quantity">[]) {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

/** Integer cents; format with `formatPrice` at render time. */
export function subtotalCents(items: Pick<BagItem, "lineTotalCents">[]) {
  return items.reduce((total, item) => total + item.lineTotalCents, 0);
}

/** Reads the bag cookie in the browser. Returns the raw cookie value, or "" when absent. */
export function readBagCookie(cookieHeader: string) {
  const prefix = `${BAG_COOKIE}=`;
  const pair = cookieHeader.split("; ").find((part) => part.startsWith(prefix));
  if (!pair) return "";
  try {
    return decodeURIComponent(pair.slice(prefix.length));
  } catch {
    // Malformed percent-encoding: treat the bag as empty rather than breaking the header.
    return "";
  }
}
