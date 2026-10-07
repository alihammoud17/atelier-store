"use server";

import { type BagActionState, MAX_BAG_LINES, MAX_LINE_QUANTITY } from "@/lib/bag";
import { readBag, writeBag } from "@/lib/bag-server";
import { getBagProducts } from "@/lib/products";

// Bag mutations. They accept only a product ID and a quantity; price and stock always come
// from the database. No session check: guests can shop and these only touch the caller's own
// cookie. Server actions are public endpoints, so every argument is validated here.

// Form values arrive as strings. Only plain digits count: Number() would also turn "", " ",
// "1e3" and "0x10" into numbers.
function toInt(value: unknown) {
  const number = typeof value === "string" ? (/^\d{1,15}$/.test(value) ? Number(value) : NaN) : value;
  return typeof number === "number" && Number.isSafeInteger(number) ? number : null;
}

function toPositiveInt(value: unknown) {
  const number = toInt(value);
  return number !== null && number > 0 ? number : null;
}

function toQuantity(value: unknown) {
  const number = toInt(value);
  return number !== null && number >= 0 ? number : null;
}

/** Most of a product one bag line can hold: its stock, within what the cookie can store. */
function lineLimit(stock: number) {
  return Math.min(stock, MAX_LINE_QUANTITY);
}

function plural(count: number) {
  return count === 1 ? "1 piece" : `${count} pieces`;
}

async function getLiveProduct(productId: number) {
  const [product] = await getBagProducts([productId]);
  return product;
}

export async function addToBag(productIdInput: unknown): Promise<BagActionState> {
  const productId = toPositiveInt(productIdInput);
  if (!productId) return { ok: false, message: "This piece is no longer available." };

  const product = await getLiveProduct(productId);
  if (!product) return { ok: false, message: "This piece is no longer available." };
  if (product.stock <= 0) return { ok: false, message: "This piece is sold out." };

  const lines = await readBag();
  const line = lines.find((item) => item.productId === productId);
  const current = line?.quantity ?? 0;
  const limit = lineLimit(product.stock);

  if (current >= limit) {
    // Fix up a stale cookie that holds more than is now in stock.
    if (line && line.quantity !== limit) {
      line.quantity = limit;
      await writeBag(lines);
    }
    return {
      ok: false,
      message: `You already have all ${plural(limit)} in your bag.`,
      quantity: limit,
    };
  }

  if (line) {
    line.quantity = current + 1;
  } else {
    if (lines.length >= MAX_BAG_LINES) {
      return { ok: false, message: "Your bag is full. Remove a piece to add another." };
    }
    lines.push({ productId, quantity: 1 });
  }
  await writeBag(lines);
  return { ok: true, message: "Added to your bag.", quantity: current + 1 };
}

/** Sets a line's quantity, clamped to live stock (and MAX_LINE_QUANTITY). Zero removes the line. */
export async function updateBagQuantity(
  productIdInput: unknown,
  quantityInput: unknown,
): Promise<BagActionState> {
  const productId = toPositiveInt(productIdInput);
  const requested = toQuantity(quantityInput);
  if (!productId || requested === null) return { ok: false, message: "Enter a valid quantity." };

  const lines = await readBag();
  const line = lines.find((item) => item.productId === productId);
  if (!line) return { ok: false, message: "This piece is no longer in your bag." };

  const product = await getLiveProduct(productId);
  const limit = lineLimit(product?.stock ?? 0);
  const quantity = Math.min(requested, limit);

  if (quantity === 0) {
    await writeBag(lines.filter((item) => item !== line));
    return {
      ok: requested === 0,
      message: requested === 0 ? "Removed from your bag." : "This piece is sold out and was removed.",
      quantity: 0,
    };
  }

  line.quantity = quantity;
  await writeBag(lines);
  if (quantity < requested) {
    return { ok: false, message: `Only ${plural(limit)} available.`, quantity };
  }
  return { ok: true, message: "Quantity updated.", quantity };
}

export async function removeFromBag(productIdInput: unknown): Promise<BagActionState> {
  const productId = toPositiveInt(productIdInput);
  if (!productId) return { ok: false, message: "This piece is no longer in your bag." };

  const lines = await readBag();
  await writeBag(lines.filter((item) => item.productId !== productId));
  return { ok: true, message: "Removed from your bag.", quantity: 0 };
}
