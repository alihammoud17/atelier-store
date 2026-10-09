import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

// Shared chrome only. Every admin page and action still calls requireAdmin() itself: a layout
// doesn't re-render on every navigation, so it's no security boundary.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <main id="main" className="flex-1">
      <div className="border-b border-line">
        <div className="container-content flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-10">
            <Link href="/admin" className="text-label link-reveal self-start">
              Atelier admin
            </Link>
            <AdminNav />
          </div>
          <div className="hidden sm:block">
            <SignOutButton />
          </div>
        </div>
      </div>
      {children}
    </main>
  );
}
