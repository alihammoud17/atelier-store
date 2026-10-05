import type { ReactNode } from "react";
import { Eyebrow, Heading } from "@/components/ui";

/** Narrow centered column shared by the sign-in and sign-up pages. */
export function AuthPage({
  eyebrow,
  title,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main id="main" className="flex-1">
      <section aria-labelledby="auth-title" className="container-page py-section">
        <div className="mx-auto flex max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-3 text-center">
            <Eyebrow className="text-ink-muted">{eyebrow}</Eyebrow>
            <Heading as="h1" id="auth-title" size="3xl">
              {title}
            </Heading>
          </div>
          {children}
          {footer && (
            <div className="border-t border-line pt-6 text-center text-sm text-ink-muted">
              {footer}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
