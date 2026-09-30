"use client";

import Image, { type ImageLoader, type ImageProps } from "next/image";

// Unsplash serves resized, format-negotiated images from its own CDN, so ask it for each
// srcset width directly rather than proxying full-size originals through the Next optimizer.
const unsplashLoader: ImageLoader = ({ src, width, quality }) => {
  const url = new URL(src);
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "max");
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 75));
  return url.toString();
};

/** `next/image` for catalog photography; other sources fall through to the default loader. */
export function CatalogImage({ alt, ...props }: ImageProps) {
  const isUnsplash =
    typeof props.src === "string" && props.src.startsWith("https://images.unsplash.com/");
  return <Image alt={alt} loader={isUnsplash ? unsplashLoader : undefined} {...props} />;
}
