"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

// Placeholder until a mailing-list provider is connected: confirms locally, stores nothing.
export function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <p role="status" className="text-sm text-ink-muted">
        Thank you. You&apos;ll hear from us soon.
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
      className="flex flex-col gap-3 sm:flex-row"
    >
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder="Email address"
        className="h-12 min-w-0 flex-1 border border-line bg-canvas px-4 outline-none focus:border-line-strong"
      />
      <Button type="submit">Subscribe</Button>
    </form>
  );
}
