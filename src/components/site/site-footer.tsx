import Link from "next/link";
import { Eyebrow, Heading, Text } from "@/components/ui";
import { footerNav, legalNav } from "@/lib/navigation";
import { NewsletterForm } from "./newsletter-form";

export function SiteFooter() {
  return (
    <footer className="border-t bg-surface">
      <div className="container-page grid gap-12 py-section lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="max-w-md">
          <Heading size="2xl">Letters from the atelier</Heading>
          <Text tone="muted" className="mt-3 mb-6">
            New collections, private events and stories from our workshops, a few times a season.
          </Text>
          <NewsletterForm />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
          {footerNav.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <Eyebrow as="h2" className="mb-4">
                {group.title}
              </Eyebrow>
              <ul role="list" className="flex flex-col gap-3 text-sm">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="link-reveal text-ink-muted hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t">
        <div className="container-page flex flex-col gap-4 py-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Atelier Store. Photography via Unsplash.</p>
          <ul role="list" className="flex gap-6">
            {legalNav.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="link-reveal hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
