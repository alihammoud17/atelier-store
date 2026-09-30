import type { ComponentProps, ElementType } from "react";
import { cx } from "@/lib/cx";

type PolymorphicProps<T extends ElementType> = { as?: T } & Omit<ComponentProps<T>, "as">;

const containerSizes = {
  page: "container-page",
  content: "container-content",
  reading: "container-reading",
} as const;

/** Centered, max-width wrapper with the responsive page gutter. */
export function Container<T extends ElementType = "div">({
  as,
  size = "page",
  className,
  ...props
}: PolymorphicProps<T> & { size?: keyof typeof containerSizes }) {
  const Tag: ElementType = as ?? "div";
  return <Tag className={cx(containerSizes[size], className)} {...props} />;
}

/** Vertical rhythm between page sections; `divider` adds a top hairline. */
export function Section<T extends ElementType = "section">({
  as,
  divider = false,
  className,
  ...props
}: PolymorphicProps<T> & { divider?: boolean }) {
  const Tag: ElementType = as ?? "section";
  return <Tag className={cx("section-y", divider && "border-t", className)} {...props} />;
}

export function Divider({ className, ...props }: ComponentProps<"hr">) {
  return <hr className={cx("border-line", className)} {...props} />;
}

/** Responsive product listing grid (2 → 3 → 4 columns). */
export function ProductGrid({ className, ...props }: ComponentProps<"ul">) {
  return <ul role="list" className={cx("grid-products", className)} {...props} />;
}

/** Horizontal snap-scrolling carousel. */
export function Rail({ className, ...props }: ComponentProps<"ul">) {
  return <ul role="list" className={cx("rail", className)} {...props} />;
}

const aspects = {
  product: "aspect-product",
  editorial: "aspect-editorial",
  landscape: "aspect-landscape",
  square: "aspect-square",
} as const;

/** Fixed-ratio image frame on the neutral product backdrop. Put a `next/image` with `fill` inside. */
export function MediaFrame({
  aspect = "product",
  className,
  ...props
}: ComponentProps<"div"> & { aspect?: keyof typeof aspects }) {
  return <div className={cx("media-frame", aspects[aspect], className)} {...props} />;
}
