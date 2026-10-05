"use client";

import { removeFromBag } from "@/app/bag/actions";
import { useBagAction } from "./use-bag-action";

export function RemoveFromBagButton({ productId, productName }: { productId: number; productName: string }) {
  const { state, pending, run } = useBagAction(removeFromBag);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        aria-label={`Remove ${productName} from bag`}
        aria-disabled={pending || undefined}
        className="text-label link-reveal aria-disabled:opacity-40"
        onClick={() => run(productId)}
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state && !state.ok && !pending && (
        <p role="status" className="text-right text-sm text-danger">
          {state.message}
        </p>
      )}
    </div>
  );
}
