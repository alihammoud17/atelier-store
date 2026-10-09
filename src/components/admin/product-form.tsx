"use client";

import { useActionState } from "react";
import { createProductAction, updateProductAction } from "@/app/admin/products/actions";
import { Button } from "@/components/ui";
import { type AdminFormState, formatPriceInput, MAX_STOCK_QUANTITY, type ProductField } from "@/lib/admin-forms";
import { FormMessage, SelectField, TextAreaField, TextField } from "./form-fields";

export type ProductFormProduct = {
  id: number;
  name: string;
  slug: string;
  categoryId: number;
  priceCents: number;
  description: string;
  details: string[];
  imageSrc: string;
  imageAlt: string;
  badge: string | null;
  isGiftEdit: boolean;
};

type ProductFormProps = {
  categories: { id: number; name: string }[];
  /** The product being edited; omit to create one (which also sets its initial stock). */
  product?: ProductFormProduct;
};

/**
 * Create and edit form. The server action validates everything again; on failure it sends
 * the submitted values back, since React resets the form after the action runs.
 */
export function ProductForm({ categories, product }: ProductFormProps) {
  const [state, action, pending] = useActionState<AdminFormState<ProductField>, FormData>(
    product ? updateProductAction : createProductAction,
    null,
  );
  const values = state?.values;
  const errors = state?.fieldErrors ?? {};
  const value = (name: string, fallback: string) => values?.[name] ?? fallback;
  const id = product ? `product-${product.id}` : "product-new";

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
      {product && <input type="hidden" name="productId" value={product.id} />}

      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          idPrefix={id}
          label="Name"
          name="name"
          required
          defaultValue={value("name", product?.name ?? "")}
          error={errors.name}
        />
        <TextField
          idPrefix={id}
          label="URL slug"
          name="slug"
          required
          defaultValue={value("slug", product?.slug ?? "")}
          error={errors.slug}
          hint={
            product
              ? "Changing it changes the product's address; old links stop working."
              : "Lowercase letters, numbers and hyphens, e.g. wool-coat."
          }
          autoCapitalize="none"
          spellCheck={false}
        />
        <SelectField
          // React applies a select's defaultValue only on mount, so remount it with the
          // returned value; otherwise the post-action form reset would clear the choice.
          key={values?.categoryId ?? "initial"}
          idPrefix={id}
          label="Category"
          name="categoryId"
          required
          defaultValue={value("categoryId", product ? String(product.categoryId) : "")}
          error={errors.categoryId}
        >
          <option value="" disabled>
            Choose a category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <TextField
          idPrefix={id}
          label="Price (USD)"
          name="price"
          required
          inputMode="decimal"
          defaultValue={value("price", product ? formatPriceInput(product.priceCents) : "")}
          error={errors.price}
          hint="In dollars, e.g. 129 or 129.50."
        />
      </div>

      <TextAreaField
        idPrefix={id}
        label="Description"
        name="description"
        required
        rows={4}
        defaultValue={value("description", product?.description ?? "")}
        error={errors.description}
      />
      <TextAreaField
        idPrefix={id}
        label="Details"
        name="details"
        rows={4}
        defaultValue={value("details", product?.details.join("\n") ?? "")}
        error={errors.details}
        hint="One per line, e.g. materials and care."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          idPrefix={id}
          label="Image URL"
          name="imageSrc"
          type="url"
          required
          defaultValue={value("imageSrc", product?.imageSrc ?? "")}
          error={errors.imageSrc}
          hint="An https://images.unsplash.com/… link."
          spellCheck={false}
        />
        <TextField
          idPrefix={id}
          label="Image description"
          name="imageAlt"
          required
          defaultValue={value("imageAlt", product?.imageAlt ?? "")}
          error={errors.imageAlt}
          hint="Alt text for screen readers."
        />
        <TextField
          idPrefix={id}
          label="Badge"
          name="badge"
          defaultValue={value("badge", product?.badge ?? "")}
          error={errors.badge}
          hint="Optional, e.g. New season."
        />
        {!product && (
          <TextField
            idPrefix={id}
            label="Initial stock"
            name="stock"
            type="number"
            min={0}
            max={MAX_STOCK_QUANTITY}
            step={1}
            inputMode="numeric"
            defaultValue={value("stock", "0")}
            error={errors.stock}
          />
        )}
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="isGiftEdit"
          defaultChecked={values ? values.isGiftEdit === "on" : (product?.isGiftEdit ?? false)}
          className="size-4 accent-ink"
        />
        Include in the gift edit
      </label>

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:gap-6">
        <Button type="submit" aria-busy={pending || undefined}>
          {pending ? "Saving…" : product ? "Save product" : "Create product"}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
