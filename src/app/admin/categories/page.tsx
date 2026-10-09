import type { Metadata } from "next";
import Link from "next/link";
import { AdminCell, AdminRow, AdminTable } from "@/components/admin/admin-table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CategoryForm } from "@/components/admin/category-form";
import { Heading, Text } from "@/components/ui";
import { getAdminCategories } from "@/lib/admin-catalog";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Categories · Admin",
};

export default async function AdminCategoriesPage({ searchParams }: PageProps<"/admin/categories">) {
  await requireAdmin();
  const categories = await getAdminCategories();
  const deleted = (await searchParams).deleted === "1";

  return (
    <section aria-labelledby="categories-title" className="container-content py-section">
      <AdminPageHeader
        eyebrow={categories.length === 1 ? "1 category" : `${categories.length} categories`}
        title="Categories"
        titleId="categories-title"
      />

      {deleted && (
        <p role="status" className="mb-8 border border-line bg-surface px-4 py-3 text-sm">
          Category deleted.
        </p>
      )}

      {categories.length === 0 ? (
        <Text tone="muted">No categories yet.</Text>
      ) : (
        <AdminTable
          caption="Categories in home-grid order"
          columns={[
            { label: "Category" },
            { label: "Title" },
            { label: "Products", className: "text-right" },
            { label: "Position", className: "text-right" },
            { label: "Home grid" },
          ]}
        >
          {categories.map((category) => (
            <AdminRow key={category.id}>
              <AdminCell className="col-span-2 sm:col-span-1">
                <Link href={`/admin/categories/${category.id}`} className="link-reveal self-start font-medium">
                  {category.name}
                </Link>
                <span className="block text-ink-muted break-all">/collections/{category.slug}</span>
              </AdminCell>
              <AdminCell label="Title">{category.title}</AdminCell>
              <AdminCell label="Products" className="tabular-nums sm:text-right">
                {category.productCount}
              </AdminCell>
              <AdminCell label="Position" className="tabular-nums sm:text-right">
                {category.position}
              </AdminCell>
              <AdminCell label="Home grid" className="text-ink-muted">
                {category.imageSrc ? "Shown" : "No image"}
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}

      <section aria-labelledby="new-category-title" className="mt-16 max-w-3xl border-t border-line pt-10">
        <Heading as="h2" id="new-category-title" size="lg" className="mb-6">
          New category
        </Heading>
        <CategoryForm />
      </section>
    </section>
  );
}
