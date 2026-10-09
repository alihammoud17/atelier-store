import type { ComponentProps, ReactNode } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

// Labelled admin form controls in the same style as the auth form: hairline borders, an
// inline error that replaces the hint, and aria wiring between them.

type FieldProps = {
  label: string;
  name: string;
  /** Prefix for the control's ID, so one page can hold several forms. */
  idPrefix: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
};

const controlClasses = (invalid: boolean) =>
  cx(
    "w-full border bg-canvas px-4 outline-none",
    invalid ? "border-danger" : "border-line focus:border-line-strong",
  );

function describe(id: string, hint: ReactNode, error: string | undefined) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  className,
  children,
}: Omit<FieldProps, "name" | "idPrefix"> & { id: string; children: ReactNode }) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  name,
  idPrefix,
  hint,
  error,
  className,
  ...props
}: FieldProps & Omit<ComponentProps<"input">, "name" | "id">) {
  const id = `${idPrefix}-${name}`;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(id, hint, error)}
        className={cx("h-12", controlClasses(Boolean(error)))}
        {...props}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  name,
  idPrefix,
  hint,
  error,
  className,
  ...props
}: FieldProps & Omit<ComponentProps<"textarea">, "name" | "id">) {
  const id = `${idPrefix}-${name}`;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <textarea
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(id, hint, error)}
        className={cx("min-h-28 py-3", controlClasses(Boolean(error)))}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  idPrefix,
  hint,
  error,
  className,
  children,
  ...props
}: FieldProps & Omit<ComponentProps<"select">, "name" | "id">) {
  const id = `${idPrefix}-${name}`;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <div className="relative">
        <select
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe(id, hint, error)}
          className={cx("h-12 appearance-none pr-10", controlClasses(Boolean(error)))}
          {...props}
        >
          {children}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2"
        />
      </div>
    </FieldShell>
  );
}

/** Result line under a form: a polite status on success, an alert on failure. */
export function FormMessage({ state, className }: { state: { ok: boolean; message: string } | null; className?: string }) {
  return (
    <p
      role={state && !state.ok ? "alert" : "status"}
      className={cx("min-h-5 text-sm", state?.ok ? "text-success" : "text-danger", className)}
    >
      {state?.message}
    </p>
  );
}
