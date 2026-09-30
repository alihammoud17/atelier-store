import { ButtonLink, CatalogImage, Eyebrow } from "@/components/ui";
import { campaign } from "@/lib/catalog";

// Edge-to-edge image break between product sections.
export function CampaignBanner() {
  return (
    <section
      aria-labelledby="campaign-title"
      className="relative aspect-editorial max-h-[56rem] w-full bg-surface md:aspect-landscape"
    >
      <CatalogImage src={campaign.image.src} alt={campaign.image.alt} fill sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-overlay" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-gutter text-center text-white">
        <Eyebrow>{campaign.eyebrow}</Eyebrow>
        <h2 id="campaign-title" className="font-serif text-3xl tracking-tight">
          {campaign.title}
        </h2>
        <ButtonLink href="/collections/tailoring" variant="inverse" className="mt-2">
          Discover
        </ButtonLink>
      </div>
    </section>
  );
}
