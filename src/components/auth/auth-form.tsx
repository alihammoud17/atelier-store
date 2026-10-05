"use client";

import { type ComponentProps, type ReactNode, useRef, useState } from "react";
import { Button, TextLink } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { cx } from "@/lib/cx";

type Mode = "sign-in" | "sign-up";

type AuthFormProps = {
  mode: Mode;
  /** Already validated with safeNext() by the page. */
  next: string;
};

type FieldName = "name" | "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

// Mirror the server rules in src/lib/auth.ts (Better Auth's max is 128 by default).
const minPasswordLength = 8;
const maxPasswordLength = 128;
const maxNameLength = 100;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(mode: Mode, values: Record<FieldName, string>): FieldErrors {
  const errors: FieldErrors = {};

  if (mode === "sign-up") {
    if (!values.name) errors.name = "Enter your name.";
    else if (values.name.length > maxNameLength)
      errors.name = `Use ${maxNameLength} characters or fewer.`;
  }

  if (!values.email) errors.email = "Enter your email address.";
  else if (!emailPattern.test(values.email))
    errors.email = "Enter an email address like name@example.com.";

  if (!values.password) errors.password = "Enter your password.";
  // Length rules only on sign-up: sign-in shouldn't hint at the password policy.
  else if (mode === "sign-up" && values.password.length < minPasswordLength)
    errors.password = `Use at least ${minPasswordLength} characters.`;
  else if (mode === "sign-up" && values.password.length > maxPasswordLength)
    errors.password = `Use ${maxPasswordLength} characters or fewer.`;

  return errors;
}

type ServerError = { field?: FieldName; message: ReactNode };

function Field({
  label,
  name,
  hint,
  error,
  invalid = Boolean(error),
  ...props
}: {
  label: string;
  name: FieldName;
  hint?: string;
  /** Inline message from client-side validation. */
  error?: string;
  /** Highlight without an inline message, e.g. when the server error names this field. */
  invalid?: boolean;
} & ComponentProps<"input">) {
  const id = `auth-${name}`;
  // The error replaces the hint rather than repeating it.
  const showHint = hint && !error;
  const describedBy = error ? `${id}-error` : showHint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cx(
          "h-12 w-full border bg-canvas px-4 outline-none",
          invalid ? "border-danger" : "border-line focus:border-line-strong",
        )}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
      {showHint && (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function AuthForm({ mode, next }: AuthFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<ServerError | null>(null);
  const [pending, setPending] = useState(false);

  const isSignUp = mode === "sign-up";

  function focusField(name: FieldName) {
    formRef.current?.querySelector<HTMLInputElement>(`[name="${name}"]`)?.focus();
  }

  // Map Better Auth responses to copy that tells the customer what to do next.
  function describeError(error: { code?: string; status: number; message?: string }): ServerError {
    if (error.status === 429)
      return { message: "Too many attempts. Please wait a minute and try again." };
    switch (error.code) {
      case "INVALID_EMAIL_OR_PASSWORD":
        return { field: "password", message: "That email and password don't match our records." };
      case "USER_ALREADY_EXISTS":
      case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
        return {
          field: "email",
          message: (
            <>
              An account with this email already exists.{" "}
              <TextLink href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in instead</TextLink>
            </>
          ),
        };
      case "INVALID_EMAIL":
        return { field: "email", message: "Enter an email address like name@example.com." };
      case "PASSWORD_TOO_SHORT":
      case "PASSWORD_TOO_LONG":
        return { field: "password", message: error.message ?? "Choose a different password." };
      default:
        return { message: "Something went wrong on our side. Please try again." };
    }
  }

  // Clear a field's message as soon as the customer edits it.
  function handleChange(event: React.FormEvent<HTMLFormElement>) {
    const { name } = event.target as EventTarget as HTMLInputElement;
    if (errors[name as FieldName]) setErrors((current) => ({ ...current, [name]: undefined }));
    if (serverError) setServerError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    const values = {
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    };

    const fieldErrors = validate(mode, values);
    setErrors(fieldErrors);
    setServerError(null);
    const firstInvalid = (["name", "email", "password"] as const).find((f) => fieldErrors[f]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    setPending(true);
    try {
      const { error } = isSignUp
        ? await authClient.signUp.email(values)
        : await authClient.signIn.email({ email: values.email, password: values.password });

      if (error) {
        const described = describeError(error);
        setServerError(described);
        if (described.field) focusField(described.field);
        setPending(false);
        return;
      }
    } catch {
      setServerError({ message: "We couldn't reach the server. Check your connection and try again." });
      setPending(false);
      return;
    }

    // Stay pending while the next page loads so the form can't be resubmitted.
    // Full page load, not router.replace(): the client router may have cached the proxy's
    // signed-out redirect for `next` (e.g. /account -> /sign-in) and would replay it.
    window.location.assign(next);
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      onChange={handleChange}
      aria-busy={pending}
      className="flex flex-col gap-6"
    >
      {serverError && (
        <div role="alert" className="border border-danger px-4 py-3 text-sm text-danger">
          {serverError.message}
        </div>
      )}

      {isSignUp && (
        <Field
          label="Name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={maxNameLength}
          error={errors.name}
        />
      )}
      <Field
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        error={errors.email}
        invalid={Boolean(errors.email) || serverError?.field === "email"}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={isSignUp ? "new-password" : "current-password"}
        hint={isSignUp ? `At least ${minPasswordLength} characters.` : undefined}
        error={errors.password}
        invalid={Boolean(errors.password) || serverError?.field === "password"}
      />

      {/* aria-disabled rather than disabled keeps focus on the button while submitting. */}
      <Button type="submit" block aria-disabled={pending || undefined}>
        {pending
          ? isSignUp
            ? "Creating account…"
            : "Signing in…"
          : isSignUp
            ? "Create account"
            : "Sign in"}
      </Button>

      <p className="sr-only" aria-live="polite">
        {pending ? (isSignUp ? "Creating your account" : "Signing you in") : ""}
      </p>
    </form>
  );
}
