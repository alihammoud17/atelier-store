import type { Metadata } from "next";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Eyebrow, Heading, Text, TextLink } from "@/components/ui";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false },
};

export default async function AccountPage() {
  const { user } = await requireSession("/account");

  return (
    <main id="main" className="flex-1">
      <section aria-labelledby="account-title" className="container-content py-section">
        <div className="mb-10 flex flex-col gap-3 border-b border-line pb-8">
          <Eyebrow className="text-ink-muted">Your account</Eyebrow>
          <Heading as="h1" id="account-title" size="3xl" className="break-words">
            Hello, {user.name}
          </Heading>
        </div>

        <dl className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <dt className="text-label text-ink-muted">Name</dt>
            <dd className="break-words">{user.name}</dd>
          </div>
          <div className="flex flex-col gap-2">
            <dt className="text-label text-ink-muted">Email</dt>
            <dd className="break-words">{user.email}</dd>
          </div>
        </dl>

        <div className="mt-12 flex flex-wrap items-center gap-6 border-t border-line pt-8">
          <SignOutButton />
          {user.role === "admin" && (
            <TextLink href="/admin">Go to admin</TextLink>
          )}
        </div>
        <Text size="sm" tone="muted" className="mt-6">
          Orders and saved addresses will appear here.
        </Text>
      </section>
    </main>
  );
}
