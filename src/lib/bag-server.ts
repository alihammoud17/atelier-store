import "server-only";
import { cookies } from "next/headers";
import { BAG_COOKIE, type BagItem, type BagLine, parseBag, serializeBag, subtotalCents } from "@/lib/bag";
import { getBagProducts } from "@/lib/products";

// Server-side bag access. The cookie only says which products and how many; everything
// customers pay for (price, stock) comes from the database on every read.

export async function readBag() {
  const store = await cookies();
  return parseBag(store.get(BAG_COOKIE)?.value);
}

/** Server Functions only: cookies can't be written while a Server Component renders. */
export async function writeBag(lines: BagLine[]) {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(BAG_COOKIE);
    return;
  }
  store.set(BAG_COOKIE, serializeBag(lines), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Readable by the header badge; it holds no prices or personal data.
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Bag lines resolved against live product data, in the order they were added. */
export async function getBag() {
  const lines = await readBag();
  const products = await getBagProducts(lines.map((line) => line.productId));
  const byId = new Map(products.map((product) => [product.id, product]));

  const items: BagItem[] = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    // Products deleted since they were added drop out silently.
    if (!product) continue;
    const quantity = Math.min(line.quantity, product.stock);
    items.push({
      ...product,
      requested: line.quantity,
      quantity,
      lineTotalCents: product.priceCents * quantity,
    });
  }

  return { items, subtotalCents: subtotalCents(items) };
}
