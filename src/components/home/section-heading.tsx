import { ButtonLink, Eyebrow, Heading } from "@/components/ui";

type SectionHeadingProps = {
  id: string;
  eyebrow?: string;
  title: string;
  action?: { label: string; href: string };
};

/** Title row for a homepage section, with an optional "view all" link on the right. */
export function SectionHeading({ id, eyebrow, title, action }: SectionHeadingProps) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 md:mb-10">
      <div className="flex flex-col gap-2">
        {eyebrow && <Eyebrow className="text-ink-muted">{eyebrow}</Eyebrow>}
        <Heading id={id} size="2xl">
          {title}
        </Heading>
      </div>
      {action && (
        <ButtonLink href={action.href} variant="ghost" className="shrink-0">
          {action.label}
        </ButtonLink>
      )}
    </div>
  );
}
