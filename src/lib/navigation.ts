export type NavLink = { label: string; href: string };

export const mainNav: NavLink[] = [
  { label: "New In", href: "/collections/new-in" },
  { label: "Women", href: "/collections/women" },
  { label: "Men", href: "/collections/men" },
  { label: "Bags", href: "/collections/bags" },
  { label: "Jewelry", href: "/collections/jewelry" },
  { label: "Gifts", href: "/collections/gifts" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Client Services",
    links: [
      { label: "Contact us", href: "/help/contact" },
      { label: "Shipping", href: "/help/shipping" },
      { label: "Returns & exchanges", href: "/help/returns" },
      { label: "Care & repairs", href: "/help/care" },
      { label: "FAQ", href: "/help" },
    ],
  },
  {
    title: "The House",
    links: [
      { label: "Our story", href: "/about" },
      { label: "Craftsmanship", href: "/about/craft" },
      { label: "Sustainability", href: "/about/sustainability" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    title: "Shop",
    links: [
      { label: "Women", href: "/collections/women" },
      { label: "Men", href: "/collections/men" },
      { label: "Bags", href: "/collections/bags" },
      { label: "Shoes", href: "/collections/shoes" },
      { label: "Jewelry", href: "/collections/jewelry" },
    ],
  },
];

export const legalNav: NavLink[] = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Accessibility", href: "/legal/accessibility" },
];
