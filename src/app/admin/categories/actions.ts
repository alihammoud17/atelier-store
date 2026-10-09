"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCategory, deleteCategory, updateCategory } from "@/lib/admin-catalog";
import { type AdminFormState, type CategoryField, formValues, parseCategoryForm } from "@/lib/admin-forms";
import { toPositiveInt } from "@/lib/form-values";
import { requireAdmin } from "@/lib/session";

// Category admin actions. Server actions are public endpoints: each one checks the admin role
// first, then validates every field.

type State = AdminFormState<CategoryField>;

const checkFields = "Check the highlighted fields.";

export async function createCategoryAction(_state: State, formData: FormData): Promise<State> {
  await requireAdmin();

  const parsed = parseCategoryForm(formData);
  if (!parsed.ok) return { ok: false, message: checkFields, fieldErrors: parsed.fieldErrors, values: formValues(formData) };

  const created = await createCategory(parsed.value);
  if (!created.ok) return { ...created, values: formValues(formData) };

  // Categories appear in the home grid, collection pages and on every product card.
  revalidatePath("/", "layout");
  return { ok: true, message: `Category “${parsed.value.name}” created.` };
}

export async function updateCategoryAction(_state: State, formData: FormData): Promise<State> {
  await requireAdmin();

  const categoryId = toPositiveInt(formData.get("categoryId"));
  if (!categoryId) return { ok: false, message: "This category no longer exists." };
  const parsed = parseCategoryForm(formData);
  if (!parsed.ok) return { ok: false, message: checkFields, fieldErrors: parsed.fieldErrors, values: formValues(formData) };

  const updated = await updateCategory(categoryId, parsed.value);
  if (!updated.ok) return { ...updated, values: formValues(formData) };

  revalidatePath("/", "layout");
  return { ok: true, message: "Category saved." };
}

export async function deleteCategoryAction(_state: State, formData: FormData): Promise<State> {
  await requireAdmin();

  const categoryId = toPositiveInt(formData.get("categoryId"));
  if (!categoryId) return { ok: false, message: "This category no longer exists." };

  const deleted = await deleteCategory(categoryId);
  if (!deleted.ok) return deleted;

  revalidatePath("/", "layout");
  redirect("/admin/categories?deleted=1");
}
