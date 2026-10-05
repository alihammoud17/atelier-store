"use client";

import { updateBagQuantity } from "@/app/bag/actions";
import { cx } from "@/lib/cx";
import { useBagAction } from "./use-bag-action";

const stepButton =
  "inline-flex size-10 items-center justify-center text-md transition-opacity hover:opacity-60 disabled:pointer-events-none disabled:opacity-30";

/** − / + for one bag line. The server clamps every change to live stock; − at 1 removes the line. */
export function QuantityStepper({
  productId,
  productName,
  quantity,
  stock,
}: {
  productId: number;
  productName: string;
  quantity: number;
  stock: number;
}) {
  const { state, pending, run } = useBagAction(updateBagQuantity);
  const error = state && !state.ok && !pending ? state.message : null;
  const atMax = quantity >= stock;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={`Quantity of ${productName}`}
        aria-busy={pending || undefined}
        className={cx(
          "inline-flex items-center self-start border border-line transition-opacity",
          pending && "opacity-60",
        )}
      >
        <button
          type="button"
          className={stepButton}
          aria-label={quantity <= 1 ? `Remove ${productName}` : `Decrease quantity of ${productName}`}
          disabled={pending}
          onClick={() => run(productId, quantity - 1)}
        >
          −
        </button>
        <output aria-live="polite" className="w-8 text-center text-sm tabular-nums">
          {quantity}
        </output>
        <button
          type="button"
          className={stepButton}
          aria-label={`Increase quantity of ${productName}`}
          disabled={pending || atMax}
          onClick={() => run(productId, quantity + 1)}
        >
          +
        </button>
      </div>
      {error ? (
        <p role="status" className="text-sm text-danger">
          {error}
        </p>
      ) : (
        atMax && <p className="text-sm text-ink-muted">Maximum available</p>
      )}
    </div>
  );
}
