import Link from "next/link";
import { CatalogImage, Eyebrow, Heading, MediaFrame } from "@/components/ui";
import { featuredCollections } from "@/lib/catalog";

export function FeaturedCollections() {
  return (
    <section aria-labelledby="featured-title" className="section-y">
      <div className="container-page">
        <h2 id="featured-title" className="sr-only">
          Featured collections
        </h2>
        <ul role="list" className="grid gap-x-grid gap-y-12 md:grid-cols-2">
          {featuredCollections.map((collection) => (
            <li key={collection.slug}>
              <Link href={`/collections/${collection.slug}`} className="group block">
                <MediaFrame aspect="editorial">
                  <CatalogImage
                    src={collection.image.src}
                    alt={collection.image.alt}
                    fill
                    sizes="(min-width: 48rem) 50vw, 100vw"
                    className="transition-transform duration-1000 ease-luxe group-hover:scale-[1.02]"
                  />
                </MediaFrame>
                <div className="mt-5 flex flex-col items-center gap-2 text-center">
                  <Eyebrow className="text-ink-muted">{collection.eyebrow}</Eyebrow>
                  <Heading as="h3" size="2xl">
                    {collection.title}
                  </Heading>
                  <span className="btn btn-ghost mt-2">Shop the collection</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
