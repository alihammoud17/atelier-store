import { Text, buttonClasses } from "@/components/ui";
import { SignOutButton } from "./sign-out-button";

/** Shown on /sign-in and /sign-up instead of the form when a session already exists. */
export function SignedInNotice({ email, next }: { email: string; next: string }) {
  return (
    <div className="flex flex-col gap-6 text-center">
      <Text tone="muted" className="break-words">
        You&apos;re signed in as <span className="text-ink">{email}</span>.
      </Text>
      {/* Plain <a> on purpose: a client-side <Link> could replay a cached signed-out redirect. */}
      <a href={next} className={buttonClasses({ block: true })}>
        Continue
      </a>
      <SignOutButton block />
    </div>
  );
}
