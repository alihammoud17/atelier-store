"use client";

import { useActionState } from "react";
import { adjustStockAction } from "@/app/admin/stock/actions";
import { Button } from "@/components/ui";
import { MAX_STOCK_QUANTITY, type AdjustStockFormState } from "@/lib/admin-forms";
import { cx } from "@/lib/cx";

type AdjustStockFormProps = {
  productId: number;
  productName: string;
  className?: string;
};

/**
 * Adds or removes units, e.g. when a delivery arrives or a piece is damaged. The change applies
 * on top of the stock at that moment, so it never conflicts with a checkout. The button pressed
 * is sent as `direction`; the amount is always positive.
 */
export function AdjustStockForm({ productId, productName, className }: AdjustStockFormProps) {
  const [state, action, pending] = useActionState<AdjustStockFormState, FormData>(adjustStockAction, null);
  const id = `adjust-stock-${productId}`;
  const error = state?.fieldErrors?.amount;

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (pending) event.preventDefault();
      }}
      aria-busy={pending}
      noValidate
      className={cx("flex flex-col gap-2", className)}
    >
      <input type="hidden" name="productId" value={productId} />
      <div className="flex items-center gap-3">
        <label htmlFor={id} className="sr-only">
          Units to add or remove for {productName}
        </label>
        <input
          id={id}
          name="amount"
          type="number"
          min={1}
          max={MAX_STOCK_QUANTITY}
          step={1}
          inputMode="numeric"
          placeholder="Units"
          // React resets the form after the action; keep the amount when it was refused.
          defaultValue={state?.ok ? "" : (state?.values?.amount ?? "")}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-message`}
          className={cx(
            "h-9 w-24 border bg-canvas px-3 tabular-nums outline-none",
            error ? "border-danger" : "border-line focus:border-line-strong",
          )}
        />
        <Button type="submit" name="direction" value="add" size="sm" variant="secondary" aria-busy={pending || undefined}>
          Add
        </Button>
        <Button type="submit" name="direction" value="remove" size="sm" variant="secondary" aria-busy={pending || undefined}>
          Remove
        </Button>
      </div>
      <p
        id={`${id}-message`}
        role={state && !state.ok ? "alert" : "status"}
        className={cx("text-sm", state?.ok ? "text-success" : "text-danger")}
      >
        {error ?? state?.message}
      </p>
    </form>
  );
}
