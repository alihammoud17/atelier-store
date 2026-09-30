import Link from "next/link";
import { CatalogImage, MediaFrame } from "@/components/ui";
import { categories } from "@/lib/catalog";
import { SectionHeading } from "./section-heading";

export function CategoryGrid() {
  return (
    <section aria-labelledby="categories-title" className="section-y">
      <div className="container-page">
        <SectionHeading id="categories-title" eyebrow="Explore" title="Shop by category" />
        <ul role="list" className="grid grid-cols-2 gap-x-grid gap-y-8 lg:grid-cols-4">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link href={`/collections/${category.slug}`} className="group block">
                <MediaFrame aspect="product">
                  <CatalogImage
                    src={category.image.src}
                    alt={category.image.alt}
                    fill
                    sizes="(min-width: 64rem) 25vw, 50vw"
                    className="transition-transform duration-700 ease-luxe group-hover:scale-[1.03]"
                  />
                </MediaFrame>
                <p className="text-label mt-4 text-center">
                  <span className="link-reveal group-hover:bg-size-[100%_1px]">{category.title}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
