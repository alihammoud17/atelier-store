import { type OrderStatus, orderStatusLabels } from "@/lib/checkout";
import { cx } from "@/lib/cx";

/** Payment status with a status dot, in the same style as StockStatus. */
export function OrderStatusLabel({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 text-sm", className)}>
      <span
        aria-hidden="true"
        className={cx(
          "size-2 shrink-0 rounded-full",
          status === "paid" && "bg-success",
          (status === "processing" || status === "needs_review" || status === "pending") && "bg-ink",
          (status === "failed" || status === "expired") && "bg-danger",
        )}
      />
      {orderStatusLabels[status]}
    </span>
  );
}
