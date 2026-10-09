import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin",
};

const sections = [
  { href: "/admin/products", title: "Products", description: "Add pieces and edit names, prices, copy and imagery." },
  { href: "/admin/categories", title: "Categories", description: "Organise the collections shown in the store." },
  { href: "/admin/stock", title: "Stock", description: "See what's available and held in open checkouts, and update counts." },
  { href: "/admin/orders", title: "Orders", description: "Review placed orders and their payment status." },
];

export default async function AdminPage() {
  const { user } = await requireAdmin();

  return (
    <section aria-labelledby="admin-title" className="container-content py-section">
      <AdminPageHeader eyebrow={`Signed in as ${user.email}`} title="Admin" titleId="admin-title" />
      <ul role="list" className="grid gap-px border border-line bg-line sm:grid-cols-2">
        {sections.map(({ href, title, description }) => (
          <li key={href} className="bg-canvas">
            <Link href={href} className="group flex h-full items-start justify-between gap-6 p-6 transition-colors hover:bg-surface">
              <span className="flex flex-col gap-2">
                <span className="text-label">{title}</span>
                <span className="text-sm text-ink-muted">{description}</span>
              </span>
              <ArrowRightIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-12 border-t border-line pt-8 sm:hidden">
        <SignOutButton block />
      </div>
    </section>
  );
}
