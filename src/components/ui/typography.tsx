import type { ComponentProps, ElementType } from "react";
import { cx } from "@/lib/cx";

const headingSizes = {
  display: "text-display",
  "3xl": "font-serif text-3xl tracking-tight",
  "2xl": "font-serif text-2xl",
  xl: "text-xl",
  lg: "text-lg",
} as const;

type HeadingProps = ComponentProps<"h2"> & {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  size?: keyof typeof headingSizes;
};

/** Headlines. Serif for editorial sizes (2xl and up), sans below. Level and size are independent. */
export function Heading({ as: Tag = "h2", size = "xl", className, ...props }: HeadingProps) {
  return <Tag className={cx(headingSizes[size], className)} {...props} />;
}

/** Small uppercase tracked label: eyebrows, category names, badges. */
export function Eyebrow<T extends ElementType = "p">({
  as,
  className,
  ...props
}: { as?: T } & Omit<ComponentProps<T>, "as">) {
  const Tag: ElementType = as ?? "p";
  return <Tag className={cx("text-label", className)} {...props} />;
}

const textTones = {
  default: "text-ink",
  muted: "text-ink-muted",
} as const;

const textSizes = {
  sm: "text-sm",
  base: "text-base",
  md: "text-md",
} as const;

export function Text({
  size = "base",
  tone = "default",
  className,
  ...props
}: ComponentProps<"p"> & { size?: keyof typeof textSizes; tone?: keyof typeof textTones }) {
  return <p className={cx(textSizes[size], textTones[tone], className)} {...props} />;
}
