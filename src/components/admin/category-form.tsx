"use client";

import { useActionState } from "react";
import { createCategoryAction, updateCategoryAction } from "@/app/admin/categories/actions";
import { Button } from "@/components/ui";
import { type AdminFormState, type CategoryField, MAX_POSITION } from "@/lib/admin-forms";
import { FormMessage, TextField } from "./form-fields";

export type CategoryFormCategory = {
  id: number;
  name: string;
  title: string;
  slug: string;
  imageSrc: string | null;
  imageAlt: string | null;
  position: number;
};

/** Create and edit form for a category. A successful create clears the form for the next one. */
export function CategoryForm({ category }: { category?: CategoryFormCategory }) {
  const [state, action, pending] = useActionState<AdminFormState<CategoryField>, FormData>(
    category ? updateCategoryAction : createCategoryAction,
    null,
  );
  const values = state?.values;
  const errors = state?.fieldErrors ?? {};
  const value = (name: string, fallback: string) => values?.[name] ?? fallback;
  const id = category ? `category-${category.id}` : "category-new";

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (pending) event.preventDefault();
      }}
      aria-busy={pending}
      noValidate
      className="flex flex-col gap-6"
    >
      {category && <input type="hidden" name="categoryId" value={category.id} />}
      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          idPrefix={id}
          label="Name"
          name="name"
          required
          defaultValue={value("name", category?.name ?? "")}
          error={errors.name}
          hint="Short label on product cards, e.g. Bags."
        />
        <TextField
          idPrefix={id}
          label="Title"
          name="title"
          required
          defaultValue={value("title", category?.title ?? "")}
          error={errors.title}
          hint="Heading in the home category grid, e.g. Handbags."
        />
        <TextField
          idPrefix={id}
          label="URL slug"
          name="slug"
          required
          defaultValue={value("slug", category?.slug ?? "")}
          error={errors.slug}
          hint={category ? "Changing it changes the collection's address." : "e.g. bags, for /collections/bags."}
          autoCapitalize="none"
          spellCheck={false}
        />
        <TextField
          idPrefix={id}
          label="Position"
          name="position"
          type="number"
          min={0}
          max={MAX_POSITION}
          step={1}
          inputMode="numeric"
          defaultValue={value("position", String(category?.position ?? 0))}
          error={errors.position}
          hint="Order in the home grid, lowest first."
        />
        <TextField
          idPrefix={id}
          label="Grid image URL"
          name="imageSrc"
          type="url"
          defaultValue={value("imageSrc", category?.imageSrc ?? "")}
          error={errors.imageSrc}
          hint="Optional https://images.unsplash.com/… link. Without one, the category isn't in the home grid."
          spellCheck={false}
        />
        <TextField
          idPrefix={id}
          label="Image description"
          name="imageAlt"
          defaultValue={value("imageAlt", category?.imageAlt ?? "")}
          error={errors.imageAlt}
          hint="Required with an image."
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <Button type="submit" aria-busy={pending || undefined}>
          {pending ? "Saving…" : category ? "Save category" : "Create category"}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
