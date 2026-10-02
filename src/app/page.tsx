import { CampaignBanner } from "@/components/home/campaign-banner";
import { CategoryGrid } from "@/components/home/category-grid";
import { EditorialStory } from "@/components/home/editorial-story";
import { FeaturedCollections } from "@/components/home/featured-collections";
import { Hero } from "@/components/home/hero";
import { SectionHeading } from "@/components/home/section-heading";
import { Services } from "@/components/home/services";
import { ProductCard } from "@/components/product/product-card";
import { ProductGrid, Rail } from "@/components/ui";
import { getGiftEdit, getNewArrivals } from "@/lib/products";

// Catalog data comes from Postgres; refresh the prerendered page at most once a minute.
export const revalidate = 60;

export default async function Home() {
  const [newArrivals, giftEdit] = await Promise.all([getNewArrivals(), getGiftEdit()]);

  return (
    <main id="main" className="flex-1">
      <Hero />
      <FeaturedCollections />

      <section aria-labelledby="new-arrivals-title" className="pb-section">
        <div className="container-page">
          <SectionHeading
            id="new-arrivals-title"
            eyebrow="Just in"
            title="New arrivals"
            action={{ label: "View all", href: "/collections/new-in" }}
          />
          <ProductGrid>
            {newArrivals.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ProductGrid>
        </div>
      </section>

      <CampaignBanner />
      <CategoryGrid />
      <EditorialStory />

      <section aria-labelledby="gifts-title" className="section-y">
        <div className="container-page">
          <SectionHeading
            id="gifts-title"
            eyebrow="The gift edit"
            title="Thoughtful gifts"
            action={{ label: "Shop gifts", href: "/collections/gifts" }}
          />
          {/* Rail bleeds to the screen edge on mobile so the next card peeks in. */}
          <Rail className="-mr-gutter pr-gutter md:mr-0 md:pr-0">
            {giftEdit.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} sizes="(min-width: 80rem) 25vw, (min-width: 48rem) 33vw, 70vw" />
              </li>
            ))}
          </Rail>
        </div>
      </section>

      <Services />
    </main>
  );
}
