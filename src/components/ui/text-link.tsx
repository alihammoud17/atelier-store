import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

type TextLinkProps = ComponentProps<typeof Link> & {
  /** "inline" is always underlined (links in copy); "reveal" underlines on hover (nav, footer). */
  variant?: "inline" | "reveal";
};

export function TextLink({ variant = "inline", className, ...props }: TextLinkProps) {
  return (
    <Link
      className={cx(variant === "inline" ? "link" : "link-reveal", className)}
      {...props}
    />
  );
}
