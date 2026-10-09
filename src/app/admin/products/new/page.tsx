import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProductForm } from "@/components/admin/product-form";
import { ButtonLink, Text } from "@/components/ui";
import { getAdminCategories } from "@/lib/admin-catalog";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "New product · Admin",
};

export default async function NewProductPage() {
  await requireAdmin();
  const categories = await getAdminCategories();

  return (
    <section aria-labelledby="new-product-title" className="container-content py-section">
      <AdminPageHeader
        eyebrow={
          <Link href="/admin/products" className="link-reveal">
            Products
          </Link>
        }
        title="New product"
        titleId="new-product-title"
      />
      {categories.length === 0 ? (
        <div className="flex flex-col items-start gap-4 border border-line p-6">
          <Text tone="muted">Every product belongs to a category. Create one first.</Text>
          <ButtonLink href="/admin/categories" variant="secondary" size="sm">
            Go to categories
          </ButtonLink>
        </div>
      ) : (
        <div className="max-w-3xl">
          <ProductForm categories={categories} />
        </div>
      )}
    </section>
  );
}
