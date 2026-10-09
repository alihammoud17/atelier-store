"use client";

import { useActionState } from "react";
import { updateStockAction } from "@/app/admin/stock/actions";
import { Button } from "@/components/ui";
import { MAX_STOCK_QUANTITY, type StockFormState } from "@/lib/admin-forms";
import { cx } from "@/lib/cx";

type StockFormProps = {
  productId: number;
  productName: string;
  /** Available stock when the page rendered. */
  available: number;
  className?: string;
};

/**
 * Sets a product's available stock. It sends the quantity it showed as `expected`, so the
 * update is refused if a checkout or another admin changed stock in the meantime; the form
 * then shows the current value to start from.
 */
export function StockForm({ productId, productName, available, className }: StockFormProps) {
  const [state, action, pending] = useActionState<StockFormState, FormData>(updateStockAction, null);
  // After a save or a conflict, the action reports what the database holds now.
  const expected = state?.quantity ?? available;
  const id = `stock-${productId}`;
  const error = state?.fieldErrors?.quantity;

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
      <input type="hidden" name="expected" value={expected} />
      <div className="flex items-center gap-3">
        <label htmlFor={id} className="sr-only">
          Available stock for {productName}
        </label>
        <input
          // Remount when the database value changes so the field shows it.
          key={expected}
          id={id}
          name="quantity"
          type="number"
          min={0}
          max={MAX_STOCK_QUANTITY}
          step={1}
          inputMode="numeric"
          defaultValue={expected}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-message`}
          className={cx(
            "h-9 w-24 border bg-canvas px-3 tabular-nums outline-none",
            error ? "border-danger" : "border-line focus:border-line-strong",
          )}
        />
        <Button type="submit" size="sm" variant="secondary" aria-busy={pending || undefined}>
          {pending ? "Saving…" : "Save"}
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
