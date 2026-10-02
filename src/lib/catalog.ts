// Catalog types, formatting helpers and editorial content. Products and categories
// live in Postgres; read them through `@/lib/products` in Server Components.
// Photography: Unsplash (https://unsplash.com/license).

export type Image = {
  src: string;
  alt: string;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  /** Category label, e.g. "Bags". */
  category: string;
  priceCents: number;
  image: Image;
  badge?: string;
};

export type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

export type ProductDetails = {
  description: string;
  details: string[];
  /** Units available; drives the stock state shown on the product page. */
  stock: number;
};

export type Collection = {
  slug: string;
  eyebrow: string;
  title: string;
  image: Image;
};

function unsplash(id: string, alt: string): Image {
  return { src: `https://images.unsplash.com/photo-${id}`, alt };
}

export function formatPrice(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

export const hero = {
  eyebrow: "Autumn–Winter 2026",
  title: "The Quiet Season",
  primary: unsplash(
    "1483985988355-763728e1935b",
    "Woman in a burgundy wool coat and sunglasses carrying shopping bags",
  ),
  secondary: unsplash(
    "1506629082955-511b1aa562c8",
    "Woman in a tartan coat walking along a city street",
  ),
};

export const featuredCollections: Collection[] = [
  {
    slug: "women",
    eyebrow: "Women",
    title: "Outerwear in soft focus",
    image: unsplash("1539109136881-3be0616acf4b", "Woman in a pale blue coat in a cathedral square"),
  },
  {
    slug: "men",
    eyebrow: "Men",
    title: "Leather, reconsidered",
    image: unsplash("1487222477894-8943e31ef7b2", "Man in a brown leather jacket and round sunglasses"),
  },
];

export const editorial = {
  eyebrow: "The Atelier",
  title: "Made slowly, by hand",
  body: "Every piece begins at the cutting table. Our tailors work in small runs, finishing seams and linings by hand so each garment keeps its shape for years, not seasons.",
  image: unsplash("1507679799987-c73779587ccf", "Man fastening the button of a tailored navy suit"),
};

export const campaign = {
  eyebrow: "Tailoring",
  title: "Considered wardrobes",
  image: unsplash("1490481651871-ab68de25d43d", "Rail of cream and brown garments on wooden hangers"),
};

export function getStockStatus(stock: number): StockStatus {
  if (stock <= 0) return "out-of-stock";
  return stock <= 3 ? "low-stock" : "in-stock";
}
