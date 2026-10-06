import { Heading, Text } from "@/components/ui";
import { formatOrderDate, type OrderStatus } from "@/lib/checkout";
import { cx } from "@/lib/cx";

type Step = {
  title: string;
  detail: string;
  date?: Date;
  state: "done" | "current" | "failed";
};

type ProgressOrder = {
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
};

const summaries: Record<OrderStatus, string> = {
  paid: "Your payment is confirmed. Thank you for your order.",
  processing:
    "Your bank is still confirming this payment, which can take a few days. Your pieces are held for you until then.",
  needs_review:
    "We received your payment but need to check a detail of this order. Our team will be in touch.",
  failed: "Your bank declined this payment, so you haven’t been charged and the order won’t ship.",
  pending: "We’re waiting for your payment to be confirmed.",
  expired: "This checkout wasn’t completed, so you haven’t been charged.",
};

/** Only what we actually record: when the order was placed and where its payment stands. */
function paymentStep(order: ProgressOrder): Step {
  switch (order.status) {
    case "paid":
      return { title: "Payment confirmed", detail: "Charged in full.", date: order.paidAt ?? undefined, state: "done" };
    case "processing":
      return { title: "Payment processing", detail: "Waiting for your bank.", state: "current" };
    case "needs_review":
      return { title: "Under review", detail: "We’ll contact you shortly.", date: order.updatedAt, state: "current" };
    case "failed":
      return { title: "Payment failed", detail: "No charge was made.", date: order.updatedAt, state: "failed" };
    case "pending":
      return { title: "Awaiting payment", detail: "Not yet confirmed.", state: "current" };
    case "expired":
      return { title: "Not completed", detail: "No charge was made.", date: order.updatedAt, state: "failed" };
  }
}

/** The order's current state: a one-line summary and the steps it has been through. */
export function OrderProgress({ order }: { order: ProgressOrder }) {
  const steps: Step[] = [
    { title: "Order placed", detail: "We received your order.", date: order.createdAt, state: "done" },
    paymentStep(order),
  ];

  return (
    <section
      aria-labelledby="order-state-title"
      className={cx(
        "flex flex-col gap-6 border p-6",
        order.status === "failed" ? "border-danger" : "border-line",
      )}
    >
      <div className="flex flex-col gap-2">
        <Heading as="h2" id="order-state-title" size="lg">
          Order status
        </Heading>
        <Text tone="muted">{summaries[order.status]}</Text>
      </div>

      <ol className="grid gap-4 sm:grid-cols-2">
        {steps.map((step) => (
          <li
            key={step.title}
            aria-current={step.state === "current" ? "step" : undefined}
            className="flex gap-3 border-t border-line pt-4"
          >
            <span
              aria-hidden="true"
              className={cx(
                "mt-1.5 size-2 shrink-0 rounded-full",
                step.state === "done" && "bg-success",
                step.state === "current" && "bg-ink",
                step.state === "failed" && "bg-danger",
              )}
            />
            <span className="flex flex-col gap-1 text-sm">
              <span className={cx("font-medium", step.state === "failed" && "text-danger")}>
                {step.title}
              </span>
              <span className="text-ink-muted">
                {step.date && (
                  <>
                    <time dateTime={step.date.toISOString()}>{formatOrderDate(step.date)}</time>
                    <span aria-hidden="true"> · </span>
                  </>
                )}
                {step.detail}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
