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
 * update is refused if a checkout or another admin changed stock in the meantime. After a save
 * or a refusal the action revalidates, so the page re-renders with the current value to start
 * from: `available` is always the latest stock, whichever form changed it.
 */
export function StockForm({ productId, productName, available, className }: StockFormProps) {
  const [state, action, pending] = useActionState<StockFormState, FormData>(updateStockAction, null);
  const id = `stock-${productId}`;
  const error = state?.fieldErrors?.quantity;
  // What was typed before a rejected save, unless stock has moved since.
  const typed = state?.values?.expected === String(available) ? state.values.quantity : undefined;

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
      <input type="hidden" name="expected" value={available} />
      <div className="flex items-center gap-3">
        <label htmlFor={id} className="sr-only">
          Available stock for {productName}
        </label>
        <input
          // Remount when the database value changes so the field shows it.
          key={available}
          id={id}
          name="quantity"
          type="number"
          min={0}
          max={MAX_STOCK_QUANTITY}
          step={1}
          inputMode="numeric"
          defaultValue={typed ?? available}
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
