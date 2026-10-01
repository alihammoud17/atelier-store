// Sample catalog data for the storefront until products come from the database.
// Photography: Unsplash (https://unsplash.com/license).

export type Image = {
  src: string;
  alt: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
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

export function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
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

export const newArrivals: Product[] = [
  {
    id: "p1",
    slug: "structured-top-handle-bag",
    name: "Structured Top-Handle Bag",
    category: "Bags",
    price: 2450,
    badge: "New",
    image: unsplash("1584917865442-de89df76afd3", "Red leather top-handle bag with a metal clasp"),
  },
  {
    id: "p2",
    slug: "chevron-shoulder-bag",
    name: "Chevron Shoulder Bag",
    category: "Bags",
    price: 1890,
    badge: "New",
    image: unsplash("1566150905458-1bf1fc113f0d", "Pink leather shoulder bag with a chevron panel"),
  },
  {
    id: "p3",
    slug: "classic-leather-biker-jacket",
    name: "Classic Leather Biker Jacket",
    category: "Ready-to-wear",
    price: 3200,
    image: unsplash("1551028719-00167b16eac5", "Black leather biker jacket laid flat"),
  },
  {
    id: "p4",
    slug: "suede-derby-shoe",
    name: "Suede Derby Shoe",
    category: "Shoes",
    price: 890,
    image: unsplash("1560343090-f0409e92791a", "Green suede lace-up shoe on a pale plinth"),
  },
  {
    id: "p5",
    slug: "pearl-strand-necklace",
    name: "Pearl Strand Necklace",
    category: "Jewelry",
    price: 1150,
    badge: "Exclusive",
    image: unsplash("1515562141207-7a88fb7ce338", "Pearl necklace in an open jewelry box"),
  },
  {
    id: "p6",
    slug: "round-metal-sunglasses",
    name: "Round Metal Sunglasses",
    category: "Eyewear",
    price: 480,
    image: unsplash("1511499767150-a48a237f0083", "Round gold-frame sunglasses with green lenses"),
  },
  {
    id: "p7",
    slug: "fringed-knit-poncho",
    name: "Fringed Knit Poncho",
    category: "Ready-to-wear",
    price: 1350,
    image: unsplash("1434389677669-e08b4cac3105", "Cream knit poncho with fringe on a wooden hanger"),
  },
  {
    id: "p8",
    slug: "bifold-leather-wallet",
    name: "Bifold Leather Wallet",
    category: "Small leather goods",
    price: 420,
    image: unsplash("1627123424574-724758594e93", "Brown leather bifold wallet"),
  },
];

export const giftEdit: Product[] = [
  {
    id: "g1",
    slug: "halo-diamond-ring",
    name: "Halo Diamond Ring",
    category: "Jewelry",
    price: 4600,
    image: unsplash("1605100804763-247f67b3557e", "Diamond halo ring on a dark surface"),
  },
  {
    id: "g2",
    slug: "crescent-pendant-necklace",
    name: "Crescent Pendant Necklace",
    category: "Jewelry",
    price: 780,
    image: unsplash("1599643478518-a784e5dc4c8f", "Gold chain necklace with a crescent pendant"),
  },
  {
    id: "g3",
    slug: "cotton-jersey-t-shirt",
    name: "Cotton Jersey T-Shirt",
    category: "Ready-to-wear",
    price: 390,
    image: unsplash("1521572163474-6864f9cf17ab", "Man wearing a plain white crew-neck T-shirt"),
  },
  {
    id: "g4",
    slug: "leather-oxford-shoe",
    name: "Leather Oxford Shoe",
    category: "Shoes",
    price: 950,
    image: unsplash("1614252235316-8c857d38b5f4", "Close-up of a brown leather lace-up shoe"),
  },
  {
    id: "g5",
    slug: "canvas-city-backpack",
    name: "Canvas City Backpack",
    category: "Bags",
    price: 1250,
    image: unsplash("1553062407-98eeb64c6a62", "Navy canvas backpack on a pale background"),
  },
  {
    id: "g6",
    slug: "silk-bomber-jacket",
    name: "Silk Bomber Jacket",
    category: "Ready-to-wear",
    price: 2800,
    image: unsplash("1591047139829-d91aecb6caea", "Rust silk bomber jacket on a hanger"),
  },
];

export const categories: Collection[] = [
  {
    slug: "bags",
    eyebrow: "Bags",
    title: "Handbags",
    image: unsplash("1590874103328-eac38a683ce7", "Orange woven top-handle bag on a white plinth"),
  },
  {
    slug: "shoes",
    eyebrow: "Shoes",
    title: "Shoes",
    image: unsplash("1543163521-1bf539c55dd2", "Pair of floral print stiletto heels"),
  },
  {
    slug: "jewelry",
    eyebrow: "Jewelry",
    title: "Fine Jewelry",
    image: unsplash("1535632066927-ab7c9ab60908", "Sapphire drop earrings resting on a green leaf"),
  },
  {
    slug: "ready-to-wear",
    eyebrow: "Ready-to-wear",
    title: "Ready-to-wear",
    image: unsplash("1445205170230-053b83016050", "Coats and knitwear hanging on a boutique rail"),
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

const productDetails: Record<string, ProductDetails> = {
  "structured-top-handle-bag": {
    description: "A rigid, architectural handbag in smooth calf leather, finished with a polished metal clasp and a detachable shoulder strap.",
    details: ["Smooth calf leather", "Suede-lined interior", "Detachable strap", "Made in Italy"],
    stock: 6,
  },
  "chevron-shoulder-bag": {
    description: "A soft shoulder bag with a quilted chevron panel, cut slim to sit close to the body.",
    details: ["Lambskin leather", "Magnetic closure", "Interior zip pocket", "Made in Italy"],
    stock: 2,
  },
  "classic-leather-biker-jacket": {
    description: "The house biker, cut from supple lambskin with an asymmetric zip, notched collar and silk lining.",
    details: ["Lambskin leather", "Silk lining", "Asymmetric zip", "Made in Portugal"],
    stock: 4,
  },
  "suede-derby-shoe": {
    description: "A lace-up derby in soft Italian suede on a lightweight leather sole, hand-stitched in small runs.",
    details: ["Italian suede", "Leather sole", "Goodyear welted", "Made in Italy"],
    stock: 0,
  },
  "pearl-strand-necklace": {
    description: "A single strand of lustrous freshwater pearls, hand-knotted and closed with a gold-plated clasp.",
    details: ["Freshwater pearls", "Hand-knotted silk thread", "18k gold-plated clasp", "Length 45 cm"],
    stock: 3,
  },
  "round-metal-sunglasses": {
    description: "Fine round frames in brushed gold metal with tinted green lenses and adjustable nose pads.",
    details: ["Metal frame", "Green UV400 lenses", "Case included", "Made in Japan"],
    stock: 12,
  },
  "fringed-knit-poncho": {
    description: "A generous poncho knitted in a cream wool blend and finished with long hand-tied fringe.",
    details: ["Wool and cashmere blend", "Hand-tied fringe", "One size", "Dry clean only"],
    stock: 5,
  },
  "bifold-leather-wallet": {
    description: "A slim bifold in vegetable-tanned leather that darkens gracefully with use.",
    details: ["Vegetable-tanned leather", "Six card slots", "Two note compartments", "Made in Italy"],
    stock: 20,
  },
};

const fallbackDetails: ProductDetails = {
  description: "Crafted in small runs by our ateliers from carefully selected materials.",
  details: ["Crafted in small runs", "Complimentary gift packaging"],
  stock: 8,
};

export const allProducts: Product[] = [...newArrivals, ...giftEdit];

export function getProduct(slug: string) {
  const product = allProducts.find((item) => item.slug === slug);
  if (!product) return undefined;
  return { ...product, ...(productDetails[slug] ?? fallbackDetails) };
}

export function getRelatedProducts(product: Product, limit = 4) {
  const others = allProducts.filter((item) => item.slug !== product.slug);
  const same = others.filter((item) => item.category === product.category);
  return [...same, ...others.filter((item) => item.category !== product.category)].slice(0, limit);
}

export function getStockStatus(stock: number): StockStatus {
  if (stock <= 0) return "out-of-stock";
  return stock <= 3 ? "low-stock" : "in-stock";
}
