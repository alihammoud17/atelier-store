"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const adminSections = [
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/stock", label: "Stock" },
  { href: "/admin/orders", label: "Orders" },
] as const;

/** Section links; the current section is marked for screen readers and underlined. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin">
      <ul role="list" className="scrollbar-none flex gap-6 overflow-x-auto">
        {adminSections.map(({ href, label }) => {
          const current = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="shrink-0">
              <Link href={href} aria-current={current ? "page" : undefined} className="text-label link-reveal">
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
