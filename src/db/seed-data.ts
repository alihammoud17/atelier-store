// Starter catalog, moved here from the old static `src/lib/catalog.ts`.
// Photography: Unsplash (https://unsplash.com/license).

export type SeedCategory = {
  slug: string;
  name: string;
  title: string;
  image?: { src: string; alt: string };
  position: number;
};

export type SeedProduct = {
  slug: string;
  name: string;
  categorySlug: string;
  priceCents: number;
  description: string;
  details: string[];
  image: { src: string; alt: string };
  badge?: string;
  isGiftEdit?: boolean;
  stock: number;
};

function unsplash(id: string, alt: string) {
  return { src: `https://images.unsplash.com/photo-${id}`, alt };
}

// Grid categories first, in grid order. The last two have no image, so they stay out of the grid.
export const seedCategories: SeedCategory[] = [
  {
    slug: "bags",
    name: "Bags",
    title: "Handbags",
    image: unsplash("1590874103328-eac38a683ce7", "Orange woven top-handle bag on a white plinth"),
    position: 1,
  },
  {
    slug: "shoes",
    name: "Shoes",
    title: "Shoes",
    image: unsplash("1543163521-1bf539c55dd2", "Pair of floral print stiletto heels"),
    position: 2,
  },
  {
    slug: "jewelry",
    name: "Jewelry",
    title: "Fine Jewelry",
    image: unsplash("1535632066927-ab7c9ab60908", "Sapphire drop earrings resting on a green leaf"),
    position: 3,
  },
  {
    slug: "ready-to-wear",
    name: "Ready-to-wear",
    title: "Ready-to-wear",
    image: unsplash("1445205170230-053b83016050", "Coats and knitwear hanging on a boutique rail"),
    position: 4,
  },
  { slug: "eyewear", name: "Eyewear", title: "Eyewear", position: 5 },
  { slug: "small-leather-goods", name: "Small leather goods", title: "Small Leather Goods", position: 6 },
];

const giftDescription = "Crafted in small runs by our ateliers from carefully selected materials.";
const giftDetails = ["Crafted in small runs", "Complimentary gift packaging"];

// Newest first: the seed gives each product an older `created_at` than the one before,
// so "New arrivals" (latest 8) keeps this order.
export const seedProducts: SeedProduct[] = [
  {
    slug: "structured-top-handle-bag",
    name: "Structured Top-Handle Bag",
    categorySlug: "bags",
    priceCents: 245000,
    badge: "New",
    image: unsplash("1584917865442-de89df76afd3", "Red leather top-handle bag with a metal clasp"),
    description: "A rigid, architectural handbag in smooth calf leather, finished with a polished metal clasp and a detachable shoulder strap.",
    details: ["Smooth calf leather", "Suede-lined interior", "Detachable strap", "Made in Italy"],
    stock: 6,
  },
  {
    slug: "chevron-shoulder-bag",
    name: "Chevron Shoulder Bag",
    categorySlug: "bags",
    priceCents: 189000,
    badge: "New",
    image: unsplash("1566150905458-1bf1fc113f0d", "Pink leather shoulder bag with a chevron panel"),
    description: "A soft shoulder bag with a quilted chevron panel, cut slim to sit close to the body.",
    details: ["Lambskin leather", "Magnetic closure", "Interior zip pocket", "Made in Italy"],
    stock: 2,
  },
  {
    slug: "classic-leather-biker-jacket",
    name: "Classic Leather Biker Jacket",
    categorySlug: "ready-to-wear",
    priceCents: 320000,
    image: unsplash("1551028719-00167b16eac5", "Black leather biker jacket laid flat"),
    description: "The house biker, cut from supple lambskin with an asymmetric zip, notched collar and silk lining.",
    details: ["Lambskin leather", "Silk lining", "Asymmetric zip", "Made in Portugal"],
    stock: 4,
  },
  {
    slug: "suede-derby-shoe",
    name: "Suede Derby Shoe",
    categorySlug: "shoes",
    priceCents: 89000,
    image: unsplash("1560343090-f0409e92791a", "Green suede lace-up shoe on a pale plinth"),
    description: "A lace-up derby in soft Italian suede on a lightweight leather sole, hand-stitched in small runs.",
    details: ["Italian suede", "Leather sole", "Goodyear welted", "Made in Italy"],
    stock: 0,
  },
  {
    slug: "pearl-strand-necklace",
    name: "Pearl Strand Necklace",
    categorySlug: "jewelry",
    priceCents: 115000,
    badge: "Exclusive",
    image: unsplash("1515562141207-7a88fb7ce338", "Pearl necklace in an open jewelry box"),
    description: "A single strand of lustrous freshwater pearls, hand-knotted and closed with a gold-plated clasp.",
    details: ["Freshwater pearls", "Hand-knotted silk thread", "18k gold-plated clasp", "Length 45 cm"],
    stock: 3,
  },
  {
    slug: "round-metal-sunglasses",
    name: "Round Metal Sunglasses",
    categorySlug: "eyewear",
    priceCents: 48000,
    image: unsplash("1511499767150-a48a237f0083", "Round gold-frame sunglasses with green lenses"),
    description: "Fine round frames in brushed gold metal with tinted green lenses and adjustable nose pads.",
    details: ["Metal frame", "Green UV400 lenses", "Case included", "Made in Japan"],
    stock: 12,
  },
  {
    slug: "fringed-knit-poncho",
    name: "Fringed Knit Poncho",
    categorySlug: "ready-to-wear",
    priceCents: 135000,
    image: unsplash("1434389677669-e08b4cac3105", "Cream knit poncho with fringe on a wooden hanger"),
    description: "A generous poncho knitted in a cream wool blend and finished with long hand-tied fringe.",
    details: ["Wool and cashmere blend", "Hand-tied fringe", "One size", "Dry clean only"],
    stock: 5,
  },
  {
    slug: "bifold-leather-wallet",
    name: "Bifold Leather Wallet",
    categorySlug: "small-leather-goods",
    priceCents: 42000,
    image: unsplash("1627123424574-724758594e93", "Brown leather bifold wallet"),
    description: "A slim bifold in vegetable-tanned leather that darkens gracefully with use.",
    details: ["Vegetable-tanned leather", "Six card slots", "Two note compartments", "Made in Italy"],
    stock: 20,
  },
  {
    slug: "halo-diamond-ring",
    name: "Halo Diamond Ring",
    categorySlug: "jewelry",
    priceCents: 460000,
    isGiftEdit: true,
    image: unsplash("1605100804763-247f67b3557e", "Diamond halo ring on a dark surface"),
    description: giftDescription,
    details: giftDetails,
    stock: 8,
  },
  {
    slug: "crescent-pendant-necklace",
    name: "Crescent Pendant Necklace",
    categorySlug: "jewelry",
    priceCents: 78000,
    isGiftEdit: true,
    image: unsplash("1599643478518-a784e5dc4c8f", "Gold chain necklace with a crescent pendant"),
    description: giftDescription,
    details: giftDetails,
    stock: 8,
  },
  {
    slug: "cotton-jersey-t-shirt",
    name: "Cotton Jersey T-Shirt",
    categorySlug: "ready-to-wear",
    priceCents: 39000,
    isGiftEdit: true,
    image: unsplash("1521572163474-6864f9cf17ab", "Man wearing a plain white crew-neck T-shirt"),
    description: giftDescription,
    details: giftDetails,
    stock: 8,
  },
  {
    slug: "leather-oxford-shoe",
    name: "Leather Oxford Shoe",
    categorySlug: "shoes",
    priceCents: 95000,
    isGiftEdit: true,
    image: unsplash("1614252235316-8c857d38b5f4", "Close-up of a brown leather lace-up shoe"),
    description: giftDescription,
    details: giftDetails,
    stock: 8,
  },
  {
    slug: "canvas-city-backpack",
    name: "Canvas City Backpack",
    categorySlug: "bags",
    priceCents: 125000,
    isGiftEdit: true,
    image: unsplash("1553062407-98eeb64c6a62", "Navy canvas backpack on a pale background"),
    description: giftDescription,
    details: giftDetails,
    stock: 8,
  },
  {
    slug: "silk-bomber-jacket",
    name: "Silk Bomber Jacket",
    categorySlug: "ready-to-wear",
    priceCents: 280000,
    isGiftEdit: true,
    image: unsplash("1591047139829-d91aecb6caea", "Rust silk bomber jacket on a hanger"),
    description: giftDescription,
    details: giftDetails,
    stock: 8,
  },
];
