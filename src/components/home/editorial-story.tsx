import { ButtonLink, CatalogImage, Eyebrow, Heading, MediaFrame, Text } from "@/components/ui";
import { editorial } from "@/lib/catalog";

// Image and copy side by side from md up; stacked on mobile.
export function EditorialStory() {
  return (
    <section aria-labelledby="editorial-title" className="bg-surface">
      <div className="grid md:grid-cols-2">
        <MediaFrame aspect="editorial" className="md:aspect-auto md:min-h-[40rem]">
          <CatalogImage src={editorial.image.src} alt={editorial.image.alt} fill sizes="(min-width: 48rem) 50vw, 100vw" />
        </MediaFrame>
        <div className="flex flex-col items-start justify-center gap-5 px-gutter py-section md:px-12 lg:px-20 xl:px-28">
          <Eyebrow className="text-ink-muted">{editorial.eyebrow}</Eyebrow>
          <Heading id="editorial-title" size="3xl">
            {editorial.title}
          </Heading>
          <Text size="md" tone="muted" className="max-w-md">
            {editorial.body}
          </Text>
          <ButtonLink href="/about/craft" variant="secondary" className="mt-3">
            Our craft
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
