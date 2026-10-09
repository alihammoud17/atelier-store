"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProduct, updateProduct } from "@/lib/admin-catalog";
import { type AdminFormState, formValues, parseProductForm, type ProductField } from "@/lib/admin-forms";
import { toPositiveInt } from "@/lib/form-values";
import { requireAdmin } from "@/lib/session";

// Product admin actions. Server actions are public endpoints: each one checks the admin role
// first, then validates every field. Prices are typed in dollars and stored as cents.

type State = AdminFormState<ProductField>;

const checkFields = "Check the highlighted fields.";

export async function createProductAction(_state: State, formData: FormData): Promise<State> {
  await requireAdmin();

  const parsed = parseProductForm(formData, { withStock: true });
  if (!parsed.ok) return { ok: false, message: checkFields, fieldErrors: parsed.fieldErrors, values: formValues(formData) };

  const created = await createProduct(parsed.value);
  if (!created.ok) return { ...created, values: formValues(formData) };

  // Catalog changes show on the home page, collections, search and related products.
  revalidatePath("/", "layout");
  redirect(`/admin/products/${created.id}?saved=created`);
}

export async function updateProductAction(_state: State, formData: FormData): Promise<State> {
  await requireAdmin();

  const productId = toPositiveInt(formData.get("productId"));
  if (!productId) return { ok: false, message: "This product no longer exists." };
  const parsed = parseProductForm(formData);
  if (!parsed.ok) return { ok: false, message: checkFields, fieldErrors: parsed.fieldErrors, values: formValues(formData) };

  const updated = await updateProduct(productId, parsed.value);
  if (!updated.ok) return { ...updated, values: formValues(formData) };

  revalidatePath("/", "layout");
  return { ok: true, message: "Product saved." };
}
