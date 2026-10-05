import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthPage } from "@/components/auth/auth-page";
import { SignedInNotice } from "@/components/auth/signed-in-notice";
import { TextLink } from "@/components/ui";
import { safeNext } from "@/lib/redirects";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const next = safeNext((await searchParams).next);
  // No redirect when already signed in: if this page and a protected page ever disagree
  // about the session (e.g. a stale cookie), redirecting both ways loops forever.
  const session = await getSession();

  return (
    <AuthPage
      eyebrow="Welcome back"
      title="Sign in"
      footer={
        !session && (
          <>
            New to Atelier?{" "}
            <TextLink href={`/sign-up?next=${encodeURIComponent(next)}`} className="text-ink">
              Create an account
            </TextLink>
          </>
        )
      }
    >
      {session ? (
        <SignedInNotice email={session.user.email} next={next} />
      ) : (
        <AuthForm mode="sign-in" next={next} />
      )}
    </AuthPage>
  );
}
