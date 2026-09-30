import Link from "next/link";
import { CatalogImage, MediaFrame } from "@/components/ui";
import { formatPrice, type Product } from "@/lib/catalog";
import { WishlistButton } from "./wishlist-button";

// Image sizes for the product grid/rail: 2 columns → 3 at md → 4 at xl.
const cardSizes = "(min-width: 80rem) 25vw, (min-width: 48rem) 33vw, 50vw";

export function ProductCard({ product, sizes = cardSizes }: { product: Product; sizes?: string }) {
  return (
    <article className="group relative">
      <MediaFrame>
        <CatalogImage
          src={product.image.src}
          alt={product.image.alt}
          fill
          sizes={sizes}
          className="transition-transform duration-700 ease-luxe group-hover:scale-[1.03]"
        />
        {product.badge && (
          <span className="text-label absolute top-3 left-3 bg-canvas px-2 py-1">{product.badge}</span>
        )}
      </MediaFrame>
      <WishlistButton productName={product.name} className="absolute top-1 right-1 z-10" />

      <div className="mt-3 flex flex-col gap-1 px-1 sm:mt-4">
        <p className="text-2xs tracking-wide text-ink-muted uppercase">{product.category}</p>
        <h3 className="text-sm">
          {/* Stretched link: the whole card is clickable, the wishlist button stays separate. */}
          <Link
            href={`/products/${product.slug}`}
            className="after:absolute after:inset-0 group-hover:underline"
          >
            {product.name}
          </Link>
        </h3>
        <p className="text-sm text-ink-muted">{formatPrice(product.price)}</p>
      </div>
    </article>
  );
}
