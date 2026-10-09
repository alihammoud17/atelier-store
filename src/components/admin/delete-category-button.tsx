"use client";

import { useActionState } from "react";
import { deleteCategoryAction } from "@/app/admin/categories/actions";
import { Button, Text } from "@/components/ui";
import type { AdminFormState } from "@/lib/admin-forms";
import { FormMessage } from "./form-fields";

/** Deletes an empty category after a confirmation. Categories with products can't be deleted. */
export function DeleteCategoryButton({ category }: { category: { id: number; name: string; productCount: number } }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(deleteCategoryAction, null);

  if (category.productCount > 0) {
    return (
      <Text size="sm" tone="muted">
        This category has {category.productCount === 1 ? "1 product" : `${category.productCount} products`}. Move
        them to another category before deleting it.
      </Text>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (pending || !window.confirm(`Delete the category “${category.name}”? This can't be undone.`)) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6"
    >
      <input type="hidden" name="categoryId" value={category.id} />
      <Button type="submit" variant="secondary" aria-busy={pending || undefined}>
        {pending ? "Deleting…" : "Delete category"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
