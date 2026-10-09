import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";

// Hairline data table for admin lists. From `sm` up it's a normal table; on phones each row
// stacks into a two-column grid and every cell shows its column label above the value.

export function AdminTable({
  caption,
  columns,
  children,
}: {
  caption: string;
  /** Header labels; pass `className: "text-right"` etc. to align a column. */
  columns: { label: string; className?: string; srOnly?: boolean }[];
  children: ReactNode;
}) {
  return (
    <table className="w-full border-t border-line text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="hidden sm:table-header-group">
        <tr className="border-b border-line">
          {columns.map(({ label, className, srOnly }) => (
            <th
              key={label}
              scope="col"
              className={cx("text-label px-3 py-3 text-left font-medium text-ink-muted", className)}
            >
              {srOnly ? <span className="sr-only">{label}</span> : label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function AdminRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cx(
        "grid grid-cols-2 gap-x-4 gap-y-3 border-b border-line py-4 sm:table-row sm:py-0",
        className,
      )}
      {...props}
    />
  );
}

/** A cell; `label` is shown above the value on phones, where the header row is hidden. */
export function AdminCell({
  label,
  className,
  children,
  ...props
}: { label?: string } & ComponentProps<"td">) {
  return (
    <td className={cx("flex min-w-0 flex-col gap-1 sm:table-cell sm:px-3 sm:py-4 sm:align-middle", className)} {...props}>
      {label && (
        <span className="text-label text-ink-muted sm:hidden">
          {label}
        </span>
      )}
      {children}
    </td>
  );
}
