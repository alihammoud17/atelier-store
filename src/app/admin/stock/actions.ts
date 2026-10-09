"use server";

import { revalidatePath } from "next/cache";
import { setStock } from "@/lib/admin-catalog";
import { parseStockForm, type StockFormState } from "@/lib/admin-forms";
import { requireAdmin } from "@/lib/session";

// Stock admin action. Sets a product's available stock (open checkouts have already taken
// their units off), and only if it hasn't moved since the form was loaded.

function plural(count: number) {
  return count === 1 ? "1 unit" : `${count} units`;
}

export async function updateStockAction(_state: StockFormState, formData: FormData): Promise<StockFormState> {
  await requireAdmin();

  const parsed = parseStockForm(formData);
  if (!parsed.ok) {
    if ("invalid" in parsed) return { ok: false, message: "This product no longer exists." };
    return { ok: false, message: "Check the quantity.", fieldErrors: parsed.fieldErrors };
  }

  const { productId, quantity, expected } = parsed.value;
  const result = await setStock(productId, { quantity, expected });
  if (!result.ok) {
    if (result.reason === "not_found") return { ok: false, message: "This product no longer exists." };
    return {
      ok: false,
      message: `Stock changed to ${plural(result.current)} since you loaded this page. Check it and save again.`,
      quantity: result.current,
    };
  }

  // Stock shows on product pages and decides whether pieces can be added to the bag.
  revalidatePath("/", "layout");
  return { ok: true, message: `Stock set to ${plural(result.quantity)}.`, quantity: result.quantity };
}
