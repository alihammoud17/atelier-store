import { getStockStatus } from "@/lib/catalog";
import { cx } from "@/lib/cx";

/** Availability line with a status dot: in stock, low stock (with count) or sold out. */
export function StockStatus({ stock, className }: { stock: number; className?: string }) {
  const status = getStockStatus(stock);

  return (
    <p className={cx("flex items-center gap-2 text-sm", className)}>
      <span
        aria-hidden="true"
        className={cx(
          "size-2 rounded-full",
          status === "in-stock" && "bg-success",
          status === "low-stock" && "bg-ink",
          status === "out-of-stock" && "bg-danger",
        )}
      />
      {status === "in-stock" && "In stock"}
      {status === "low-stock" && `Only ${stock} left`}
      {status === "out-of-stock" && "Currently unavailable"}
    </p>
  );
}
