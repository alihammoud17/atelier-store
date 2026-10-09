import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CategoryForm } from "@/components/admin/category-form";
import { DeleteCategoryButton } from "@/components/admin/delete-category-button";
import { ButtonLink, Heading } from "@/components/ui";
import { getAdminCategory } from "@/lib/admin-catalog";
import { toPositiveInt } from "@/lib/form-values";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Edit category · Admin",
};

export default async function EditCategoryPage({ params }: PageProps<"/admin/categories/[categoryId]">) {
  await requireAdmin();
  const categoryId = toPositiveInt((await params).categoryId);
  if (!categoryId) notFound();
  const category = await getAdminCategory(categoryId);
  if (!category) notFound();

  return (
    <section aria-labelledby="category-title" className="container-content py-section">
      <AdminPageHeader
        eyebrow={
          <Link href="/admin/categories" className="link-reveal">
            Categories
          </Link>
        }
        title={category.name}
        titleId="category-title"
        actions={
          <ButtonLink href={`/collections/${category.slug}`} variant="secondary" size="sm" target="_blank">
            View in store
          </ButtonLink>
        }
      />
      <div className="max-w-3xl">
        <CategoryForm category={category} />
        <section aria-labelledby="delete-category-title" className="mt-16 flex flex-col gap-4 border-t border-line pt-10">
          <Heading as="h2" id="delete-category-title" size="lg">
            Delete
          </Heading>
          <DeleteCategoryButton category={category} />
        </section>
      </div>
    </section>
  );
}
