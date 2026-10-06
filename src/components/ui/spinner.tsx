import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

/** Hairline loading ring in the current text colour. Decorative: pair it with visible text. */
export function Spinner({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block size-3.5 shrink-0 rounded-full border border-current border-r-transparent motion-safe:animate-spin",
        className,
      )}
      {...props}
    />
  );
}
