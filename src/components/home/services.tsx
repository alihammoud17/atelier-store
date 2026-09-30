import { Eyebrow, Text } from "@/components/ui";

const services = [
  {
    title: "Complimentary shipping",
    body: "Free express delivery on every order, packed in our signature boxes.",
  },
  {
    title: "Returns within 30 days",
    body: "Changed your mind? Send it back free of charge within thirty days.",
  },
  {
    title: "Gift wrapping",
    body: "Every order can be wrapped by hand with a personal note.",
  },
  {
    title: "Book an appointment",
    body: "Meet a client advisor in store or by video for a private fitting.",
  },
];

export function Services() {
  return (
    <section aria-label="Client services" className="border-t">
      <ul role="list" className="container-page grid gap-10 py-section sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => (
          <li key={service.title} className="flex flex-col gap-3 text-center">
            <Eyebrow as="h3">{service.title}</Eyebrow>
            <Text size="sm" tone="muted" className="mx-auto max-w-xs">
              {service.body}
            </Text>
          </li>
        ))}
      </ul>
    </section>
  );
}
