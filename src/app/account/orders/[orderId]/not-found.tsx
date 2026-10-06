import { ButtonLink, Eyebrow, Heading, Text } from "@/components/ui";

// Shown when the order doesn't exist or belongs to another customer. Both look the same on
// purpose, so order IDs can't be probed.
export default function OrderNotFound() {
  return (
    <main id="main" className="flex-1">
      <section aria-labelledby="order-missing-title" className="container-content py-section">
        <div className="mb-8 flex flex-col gap-3 border-b border-line pb-8">
          <Eyebrow className="text-ink-muted">Order details</Eyebrow>
          <Heading as="h1" id="order-missing-title" size="3xl">
            We couldn&rsquo;t find this order
          </Heading>
        </div>
        <div className="flex flex-col gap-8">
          <Text tone="muted" className="max-w-prose">
            It may belong to a different account. Make sure you&rsquo;re signed in with the email
            you used at checkout, or find your orders in your account.
          </Text>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/account">View your orders</ButtonLink>
            <ButtonLink href="/" variant="secondary">
              Continue shopping
            </ButtonLink>
          </div>
        </div>
      </section>
    </main>
  );
}
