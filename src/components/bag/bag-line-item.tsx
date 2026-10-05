import Link from "next/link";
import { StockStatus } from "@/components/product/stock-status";
import { CatalogImage, MediaFrame } from "@/components/ui";
import type { BagItem } from "@/lib/bag";
import { formatPrice, getStockStatus } from "@/lib/catalog";
import { cx } from "@/lib/cx";
import { QuantityStepper } from "./quantity-stepper";
import { RemoveFromBagButton } from "./remove-from-bag-button";

/** One bag line: image, details, live unit price, stock state, quantity controls and line total. */
export function BagLineItem({ item }: { item: BagItem }) {
  const soldOut = item.stock <= 0;
  const reduced = !soldOut && item.quantity < item.requested;
  const href = `/products/${item.slug}`;

  return (
    <li className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 py-6 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6">
      {/* Decorative duplicate of the name link, so it's skipped by keyboard and screen readers. */}
      <Link href={href} tabIndex={-1} aria-hidden="true" className={cx(soldOut && "opacity-50")}>
        <MediaFrame>
          <CatalogImage src={item.image.src} alt="" fill sizes="8rem" />
        </MediaFrame>
      </Link>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-2xs tracking-wide text-ink-muted uppercase">{item.category}</p>
            <h2 className="text-sm">
              <Link href={href} className="link-reveal">
                {item.name}
              </Link>
            </h2>
            <p className="text-sm text-ink-muted">{formatPrice(item.priceCents)}</p>
          </div>
          <RemoveFromBagButton productId={item.id} productName={item.name} />
        </div>

        {getStockStatus(item.stock) !== "in-stock" && (
          <div className="flex flex-col gap-1">
            <StockStatus stock={item.stock} />
            {soldOut && (
              <p className="text-sm text-ink-muted">Remove it from your bag to continue.</p>
            )}
          </div>
        )}
        {reduced && (
          <p className="text-sm text-danger">
            Quantity reduced from {item.requested} to {item.quantity}: only {item.stock} available.
          </p>
        )}

        {!soldOut && (
          <div className="flex items-start justify-between gap-4">
            <QuantityStepper
              productId={item.id}
              productName={item.name}
              quantity={item.quantity}
              stock={item.stock}
            />
            <p className="flex min-h-10 shrink-0 items-center text-sm tabular-nums">
              <span className="sr-only">Line total: </span>
              {formatPrice(item.lineTotalCents)}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
