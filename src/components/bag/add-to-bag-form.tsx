"use client";

import { addToBag } from "@/app/bag/actions";
import { Button, TextLink } from "@/components/ui";
import { cx } from "@/lib/cx";
import { useBagAction } from "./use-bag-action";

/** "Add to bag" for the product page. Stock is checked again on the server for every add. */
export function AddToBagForm({
  productId,
  soldOut,
  children,
}: {
  productId: number;
  soldOut: boolean;
  /** Rendered beside the button, e.g. the wishlist toggle. */
  children?: React.ReactNode;
}) {
  const { state, pending, run } = useBagAction(addToBag);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(productId);
      }}
    >
      <div className="flex items-center gap-2">
        {/* aria-disabled rather than disabled keeps focus on the button while adding. */}
        <Button type="submit" block disabled={soldOut} aria-disabled={pending || undefined}>
          {soldOut ? "Sold out" : pending ? "Adding…" : "Add to bag"}
        </Button>
        {children}
      </div>
      <p
        aria-live="polite"
        className={cx("mt-3 min-h-5 text-sm", state && !state.ok ? "text-danger" : "text-ink-muted")}
      >
        {state && !pending && (
          <>
            {state.message}{" "}
            {state.ok && <TextLink href="/bag">View bag</TextLink>}
          </>
        )}
      </p>
    </form>
  );
}
