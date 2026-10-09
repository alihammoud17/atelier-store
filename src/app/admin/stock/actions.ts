"use server";

import { revalidatePath } from "next/cache";
import { adjustStock, setStock } from "@/lib/admin-catalog";
import {
  formValues,
  MAX_STOCK_QUANTITY,
  parseAdjustStockForm,
  parseStockForm,
  type AdjustStockFormState,
  type StockFormState,
} from "@/lib/admin-forms";
import { requireAdmin } from "@/lib/session";

// Stock admin actions. Stock is available stock: open checkouts have already taken their units
// off. Setting it only applies if it hasn't moved since the form was loaded; adding or removing
// units applies on top of whatever it is now.
//
// After a write, and after a refusal because stock had moved, revalidate: stock shows on product
// pages and decides whether pieces can be added to the bag, and the admin page re-renders with
// the current value for the next save.

function plural(count: number) {
  return count === 1 ? "1 unit" : `${count} units`;
}

export async function updateStockAction(_state: StockFormState, formData: FormData): Promise<StockFormState> {
  await requireAdmin();

  const parsed = parseStockForm(formData);
  if (!parsed.ok) {
    if ("invalid" in parsed) return { ok: false, message: "This product no longer exists." };
    return { ok: false, message: "Check the quantity.", fieldErrors: parsed.fieldErrors, values: formValues(formData) };
  }

  const { productId, quantity, expected } = parsed.value;
  const result = await setStock(productId, { quantity, expected });
  if (!result.ok) {
    if (result.reason === "not_found") return { ok: false, message: "This product no longer exists." };
    revalidatePath("/", "layout");
    return {
      ok: false,
      message: `Stock changed to ${plural(result.current)} since you loaded this page. Check it and save again.`,
      quantity: result.current,
    };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: `Stock set to ${plural(result.quantity)}.`, quantity: result.quantity };
}

export async function adjustStockAction(
  _state: AdjustStockFormState,
  formData: FormData,
): Promise<AdjustStockFormState> {
  await requireAdmin();

  const parsed = parseAdjustStockForm(formData);
  if (!parsed.ok) {
    if ("invalid" in parsed) return { ok: false, message: "This product no longer exists." };
    return { ok: false, message: "Check the amount.", fieldErrors: parsed.fieldErrors, values: formValues(formData) };
  }

  const { productId, delta } = parsed.value;
  const result = await adjustStock(productId, delta);
  if (!result.ok) {
    if (result.reason === "not_found") return { ok: false, message: "This product no longer exists." };
    revalidatePath("/", "layout");
    const message =
      delta < 0
        ? `Only ${plural(result.current)} available to remove.`
        : `Stock can't exceed ${plural(MAX_STOCK_QUANTITY)}. ${result.current} available now.`;
    return { ok: false, message, fieldErrors: { amount: message }, values: formValues(formData), quantity: result.current };
  }

  revalidatePath("/", "layout");
  const change = `${delta > 0 ? "Added" : "Removed"} ${plural(Math.abs(delta))}.`;
  return { ok: true, message: `${change} ${result.quantity} available.`, quantity: result.quantity };
}
