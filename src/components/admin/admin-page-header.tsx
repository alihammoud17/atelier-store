import type { ReactNode } from "react";
import { Eyebrow, Heading } from "@/components/ui";

/** Title block shared by admin pages, with optional actions on the right. */
export function AdminPageHeader({
  eyebrow,
  title,
  titleId,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  titleId: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-3">
        {eyebrow && <Eyebrow className="text-ink-muted">{eyebrow}</Eyebrow>}
        <Heading as="h1" id={titleId} size="3xl" className="break-words">
          {title}
        </Heading>
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
