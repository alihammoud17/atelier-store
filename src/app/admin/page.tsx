import type { Metadata } from "next";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Eyebrow, Heading, Text } from "@/components/ui";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

export default async function AdminPage() {
  const { user } = await requireAdmin();

  return (
    <main id="main" className="flex-1">
      <section aria-labelledby="admin-title" className="container-content py-section">
        <div className="mb-10 flex flex-col gap-3 border-b border-line pb-8">
          <Eyebrow className="text-ink-muted">Atelier admin</Eyebrow>
          <Heading as="h1" id="admin-title" size="3xl">
            Admin
          </Heading>
        </div>
        <Text tone="muted" className="break-words">
          Signed in as {user.email}. Catalog and order tools will live here.
        </Text>
        <div className="mt-12 border-t border-line pt-8">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
