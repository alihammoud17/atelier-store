import { ButtonLink, CatalogImage, Eyebrow } from "@/components/ui";
import { hero } from "@/lib/catalog";

// Full-bleed campaign opener: one portrait image on mobile, a two-image diptych from md up.
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative grid h-[calc(100svh-var(--header-height)-2rem)] max-h-[64rem] min-h-[34rem] md:grid-cols-2"
    >
      <div className="relative bg-surface">
        <CatalogImage
          src={hero.primary.src}
          alt={hero.primary.alt}
          fill
          preload
          sizes="(min-width: 48rem) 50vw, 100vw"
          className="object-cover object-[50%_20%]"
        />
      </div>
      <div className="relative hidden bg-surface md:block">
        <CatalogImage
          src={hero.secondary.src}
          alt={hero.secondary.alt}
          fill
          preload
          sizes="50vw"
          className="object-cover object-[50%_25%]"
        />
      </div>

      <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 via-45% to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-5 px-gutter pb-12 text-center text-white md:pb-16">
        <Eyebrow>{hero.eyebrow}</Eyebrow>
        <h1 id="hero-title" className="text-display">
          {hero.title}
        </h1>
        <div className="mt-2 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:w-auto sm:flex-row">
          <ButtonLink href="/collections/women" variant="inverse">
            Shop Women
          </ButtonLink>
          <ButtonLink href="/collections/men" variant="inverse">
            Shop Men
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
