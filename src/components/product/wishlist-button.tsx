"use client";

import { useState } from "react";
import { HeartIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

// Local toggle only; wire to a saved-items store once accounts are in place.
export function WishlistButton({ productName, className }: { productName: string; className?: string }) {
  const [saved, setSaved] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      onClick={() => setSaved((value) => !value)}
      className={cx(
        "inline-flex size-10 items-center justify-center text-lg transition-opacity hover:opacity-60",
        className,
      )}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}
