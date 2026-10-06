import type { Metadata } from "next";
import Link from "next/link";
import { BagLineItem } from "@/components/bag/bag-line-item";
import { CheckoutButton } from "@/components/checkout/checkout-button";
import { ButtonLink, Eyebrow, Heading, Text } from "@/components/ui";
import { BagIcon } from "@/components/ui/icons";
import { countItems } from "@/lib/bag";
import { getBag } from "@/lib/bag-server";
import { formatPrice } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Your bag",
  robots: { index: false },
};

// Reads the bag cookie, so this page renders per request with live prices and stock.
export default async function BagPage({ searchParams }: PageProps<"/bag">) {
  const { checkout } = await searchParams;
  const cancelled = checkout === "cancelled";
  const { items, subtotalCents } = await getBag();
  const itemCount = countItems(items);
  const hasAdjustments = items.some((item) => item.quantity < item.requested);
  const hasSoldOut = items.some((item) => item.stock <= 0);

  return (
    <main id="main" className="flex-1">
      <div className="container-page pt-6 md:pt-8">
        <nav aria-label="Breadcrumb" className="text-2xs tracking-wide text-ink-muted uppercase">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="link-reveal">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Bag</li>
          </ol>
        </nav>
      </div>

      <section aria-labelledby="bag-title" className="container-page pt-8 pb-section md:pt-12">
        <header className="mb-8 flex items-end justify-between gap-6 border-b border-line pb-6 md:mb-10">
          <div className="flex flex-col gap-2">
            <Eyebrow className="text-ink-muted">Shopping bag</Eyebrow>
            <Heading as="h1" id="bag-title" size="3xl">
              Your bag
            </Heading>
          </div>
          {items.length > 0 && (
            <Text size="sm" tone="muted" className="shrink-0">
              {itemCount} {itemCount === 1 ? "piece" : "pieces"}
            </Text>
          )}
        </header>

        {cancelled && (
          <p role="status" className="mb-6 border border-line px-4 py-3 text-sm">
            Checkout was cancelled and you haven&rsquo;t been charged. Your bag is just as you left
            it.
          </p>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-5 border border-line px-6 py-16 text-center md:py-24">
            <BagIcon className="text-2xl" />
            <Heading as="h2" size="2xl">
              Your bag is empty
            </Heading>
            <Text tone="muted" className="max-w-sm">
              Pieces you add are kept here for 30 days, at their current price and availability.
            </Text>
            <div className="mt-3 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <ButtonLink href="/collections/new-in">Shop new arrivals</ButtonLink>
              <ButtonLink href="/" variant="secondary">
                Continue shopping
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              {hasAdjustments && (
                <p role="status" className="mb-6 border border-line px-4 py-3 text-sm">
                  Some pieces have sold out or have fewer available. We&rsquo;ve updated the
                  quantities you can check out.
                </p>
              )}
              <ul role="list" className="divide-y border-y border-line">
                {items.map((item) => (
                  <BagLineItem key={item.id} item={item} />
                ))}
              </ul>
            </div>

            <aside
              aria-labelledby="summary-title"
              className="flex flex-col gap-6 bg-surface p-6 lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:self-start"
            >
              <Heading as="h2" id="summary-title" size="lg">
                Order summary
              </Heading>
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt>
                    Subtotal{" "}
                    <span className="text-ink-muted">
                      ({itemCount} {itemCount === 1 ? "piece" : "pieces"})
                    </span>
                  </dt>
                  <dd className="tabular-nums">{formatPrice(subtotalCents)}</dd>
                </div>
                <div className="flex justify-between gap-4 text-ink-muted">
                  <dt>Shipping</dt>
                  <dd>Complimentary</dd>
                </div>
              </dl>
              <Text size="sm" tone="muted">
                {hasSoldOut && "Sold-out pieces aren't included. "}
                You&rsquo;ll enter your shipping address and pay securely with Stripe.
              </Text>
              <CheckoutButton disabled={subtotalCents === 0} />
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
