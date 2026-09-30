import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

// Full class names so Tailwind's scanner can see them.
const variants = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  inverse: "btn-inverse",
  ghost: "btn-ghost",
} as const;

type ButtonVariant = keyof typeof variants;
type ButtonSize = "md" | "sm";

type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width (typical for mobile CTAs and forms). */
  block?: boolean;
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  block = false,
}: ButtonStyleProps = {}) {
  return cx(
    "btn",
    variants[variant],
    size === "sm" && variant !== "ghost" && "btn-sm",
    block && "w-full",
  );
}

export function Button({
  variant,
  size,
  block,
  className,
  type = "button",
  ...props
}: ButtonStyleProps & ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cx(buttonClasses({ variant, size, block }), className)}
      {...props}
    />
  );
}

/** A link that looks like a button. */
export function ButtonLink({
  variant,
  size,
  block,
  className,
  ...props
}: ButtonStyleProps & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cx(buttonClasses({ variant, size, block }), className)}
      {...props}
    />
  );
}
